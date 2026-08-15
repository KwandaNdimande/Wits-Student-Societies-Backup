// ---------- SUPABASE INITIALIZATION ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAsWp91SrNnlVHoyJWJyxjvXgGY6debDLE",
    authDomain: "wits-student-societies-backup.firebaseapp.com",
    projectId: "wits-student-societies-backup",
    storageBucket: "wits-student-societies-backup.firebasestorage.app",
    messagingSenderId: "111338778369",
    appId: "1:111338778369:web:5633595cd3fec3113c3500",
    measurementId: "G-D01M5HWGOV"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const userUid = localStorage.getItem('userUid');
if (!userUid) {
    window.location.href = '/login.html';
}

// ================================================================
// PAGINATION STATE
// ================================================================
let lastDoc = null;
let isLoading = false;
let hasMore = true;
const PAGE_SIZE = 3;
let allLoadedCount = 0;

const container = document.getElementById('documents-container');
const loadMoreBtn = document.getElementById('load-more-btn');

// ================================================================
// FORCE DOWNLOAD (cross-origin compatible)
// ================================================================
async function forceDownload(url, fileName) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download file. Please try again.');
    }
}

// ================================================================
// RENDER DOCUMENTS (TABLE LAYOUT)
// ================================================================
function renderDocuments(docs, append = false) {
    if (!append) {
        container.innerHTML = '';
        allLoadedCount = 0;
    }

    if (docs.length === 0 && allLoadedCount === 0) {
        container.innerHTML = `<div class="no-docs">📭 No documents available.</div>`;
        loadMoreBtn.classList.add('hidden');
        return;
    }

    let html = '';
    if (!append) {
        html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Document Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
    }

    docs.forEach((doc, index) => {
        const rowNum = allLoadedCount + index + 1;
        const d = doc.data();
        let publicUrl = '#';
        let fileName = 'file';
        if (d.storagePath) {
            const { data } = window.supabaseClient.storage
                .from('documents')
                .getPublicUrl(d.storagePath);
            publicUrl = data.publicUrl;
            fileName = d.storagePath.split('/').pop();
        }
        const hasFile = publicUrl !== '#';
        const fileIcon = getFileIcon(fileName);

        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${rowNum}</td>
                <td>
                    <span class="doc-name">${escapeHtml(d.name)}</span>
                </td>
                <td>
                    <div class="doc-actions">
                        <button class="btn-action btn-view" onclick="viewDocument('${publicUrl}')" ${!hasFile ? 'disabled' : ''}>
                            View
                        </button>
                        <button class="btn-action btn-download" onclick="downloadDocument('${publicUrl}', '${escapeHtml(fileName)}')" ${!hasFile ? 'disabled' : ''}>
                            ⬇ Download
                        </button>
                        <button class="btn-action btn-info" onclick="openInfoModal('${doc.id}')">
                            Info
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (!append) {
        html += `
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    } else {
        // For append, we need to add rows to existing tbody
        const tbody = container.querySelector('tbody');
        if (tbody) {
            const rowsHtml = docs.map((doc, index) => {
                const rowNum = allLoadedCount + index + 1;
                const d = doc.data();
                let publicUrl = '#';
                let fileName = 'file';
                if (d.storagePath) {
                    const { data } = window.supabaseClient.storage
                        .from('documents')
                        .getPublicUrl(d.storagePath);
                    publicUrl = data.publicUrl;
                    fileName = d.storagePath.split('/').pop();
                }
                const hasFile = publicUrl !== '#';
                const fileIcon = getFileIcon(fileName);
                return `
                    <tr>
                        <td style="color:#6c757d;font-weight:500;">${rowNum}</td>
                        <td>
                            <span class="doc-name">${escapeHtml(d.name)}</span>
                        </td>
                        <td>
                            <div class="doc-actions">
                                <button class="btn-action btn-view" onclick="viewDocument('${publicUrl}')" ${!hasFile ? 'disabled' : ''}>
                                    View
                                </button>
                                <button class="btn-action btn-download" onclick="downloadDocument('${publicUrl}', '${escapeHtml(fileName)}')" ${!hasFile ? 'disabled' : ''}>
                                    ⬇ Download
                                </button>
                                <button class="btn-action btn-info" onclick="openInfoModal('${doc.id}')">
                                    Info
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            tbody.insertAdjacentHTML('beforeend', rowsHtml);
        }
    }

    allLoadedCount += docs.length;
}

// ================================================================
// HELPER: Get file icon
// ================================================================
function getFileIcon(fileName) {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📄';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return '📊';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
    if (['zip', 'rar', '7z'].includes(ext)) return '📦';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    return '📁';
}

// ================================================================
// LOAD DOCUMENTS
// ================================================================
async function loadDocuments(loadMore = false) {
    if (isLoading) return;
    isLoading = true;

    if (!loadMore) {
        lastDoc = null;
        hasMore = true;
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
    } else {
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
    }

    try {
        let query = db.collection('documents')
            .orderBy('name', 'asc')
            .limit(PAGE_SIZE + 1);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            hasMore = false;
            loadMoreBtn.classList.add('hidden');
            if (!loadMore && allLoadedCount === 0) {
                container.innerHTML = `<div class="no-docs">📭 No documents available.</div>`;
            }
            isLoading = false;
            return;
        }

        const allDocs = snapshot.docs;
        const hasExtra = allDocs.length > PAGE_SIZE;
        const displayDocs = hasExtra ? allDocs.slice(0, PAGE_SIZE) : allDocs;

        if (displayDocs.length > 0) {
            lastDoc = displayDocs[displayDocs.length - 1];
        }

        renderDocuments(displayDocs, loadMore);

        hasMore = hasExtra;
        if (hasMore) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }

    } catch (error) {
        console.error('Error loading documents:', error);
        if (!loadMore) {
            container.innerHTML = `<div class="no-docs" style="color:#dc3545;">⚠️ Error loading documents.</div>`;
        } else {
            alert('Failed to load more documents.');
        }
        loadMoreBtn.classList.add('hidden');
    } finally {
        isLoading = false;
        loadMoreBtn.textContent = 'Load More';
        loadMoreBtn.disabled = false;
        if (!hasMore) {
            loadMoreBtn.classList.add('hidden');
        }
    }
}

// ================================================================
// VIEW: Open in new tab
// ================================================================
function viewDocument(url) {
    if (url && url !== '#') {
        window.open(url, '_blank');
    } else {
        alert('No file available to view.');
    }
}

// ================================================================
// DOWNLOAD: Force download
// ================================================================
function downloadDocument(url, fileName) {
    if (url && url !== '#') {
        forceDownload(url, fileName);
    } else {
        alert('No file available to download.');
    }
}

// ================================================================
// INFO MODAL
// ================================================================
let currentInfoDocId = null;

async function openInfoModal(docId) {
    try {
        const doc = await db.collection('documents').doc(docId).get();
        if (!doc.exists) {
            alert('Document not found.');
            return;
        }
        const d = doc.data();
        currentInfoDocId = docId;

        // Set modal content
        document.getElementById('info-name').textContent = d.name || '-';
        document.getElementById('info-description').textContent = d.description || 'No description';
        // Format date
        let dateStr = 'Unknown';
        if (d.uploadedAt) {
            const ts = d.uploadedAt.seconds ? d.uploadedAt.seconds * 1000 : d.uploadedAt;
            dateStr = new Date(ts).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        document.getElementById('info-date').textContent = dateStr;
        // File size
        let sizeStr = 'Unknown';
        if (d.fileSize) {
            const mb = (d.fileSize / (1024 * 1024)).toFixed(2);
            sizeStr = `${mb} MB`;
        } else if (d.storagePath) {
            // Try to get size from storage? Not easily, so show 'Available'
            sizeStr = 'Available';
        }
        document.getElementById('info-size').textContent = sizeStr;

        document.getElementById('infoModalTitle').textContent = 'Document Details';
        document.getElementById('infoModal').classList.add('active');
    } catch (error) {
        console.error('Error loading document info:', error);
        alert('Could not load document details.');
    }
}

function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('active');
    currentInfoDocId = null;
}
document.getElementById('infoModal').addEventListener('click', function(e) {
    if (e.target === this) closeInfoModal();
});

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ================================================================
// EVENT LISTENERS
// ================================================================
loadMoreBtn.addEventListener('click', function() {
    if (!isLoading && hasMore) {
        loadDocuments(true);
    }
});

// ================================================================
// LOAD DATA
// ================================================================
loadDocuments(false);