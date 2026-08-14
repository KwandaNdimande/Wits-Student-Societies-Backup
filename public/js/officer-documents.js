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

// Check authentication
const userUid = localStorage.getItem('userUid');
const userRole = localStorage.getItem('userRole');
if (!userUid || userRole !== 'officer') {
    window.location.href = '/login.html';
}

let currentEditingId = null;

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
// TOAST NOTIFICATION
// ================================================================

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('.toast-icon');

    toastMessage.textContent = message;
    toastIcon.textContent = isError ? '❌' : '✅';
    toast.style.borderLeftColor = isError ? '#C0392B' : '#1E8E5A';

    toast.classList.add('show');
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function closeToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('show');
    clearTimeout(toast._hideTimeout);
}

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
// RENDER DOCUMENTS
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
    docs.forEach(doc => {
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

        html += `
            <div class="doc-card" data-id="${doc.id}">
                <div class="doc-info">
                    <div class="doc-name">${escapeHtml(d.name)}</div>
                    <div class="doc-description">${escapeHtml(d.description || 'No description')}</div>
                </div>
                <div class="doc-actions">
                    <button class="btn-action btn-download-doc" onclick="downloadDocument('${publicUrl}', '${escapeHtml(fileName)}')" ${!hasFile ? 'disabled' : ''}>
                        ⬇ Download
                    </button>
                    <button class="btn-action btn-edit-doc" onclick="openEditDocument('${doc.id}')">Edit</button>
                    <button class="btn-action btn-delete-doc" onclick="deleteDocument('${doc.id}')">Delete</button>
                </div>
            </div>
        `;
    });

    if (append) {
        container.insertAdjacentHTML('beforeend', html);
    } else {
        container.innerHTML = html;
    }

    allLoadedCount += docs.length;
}

// ================================================================
// LOAD DOCUMENTS (with +1 detection)
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
// OPEN MODAL
// ================================================================

function openDocumentModal(editingId) {
    const modal = document.getElementById('documentModal');
    const title = document.getElementById('documentModalTitle');

    if (editingId) {
        title.textContent = 'Edit Document';
        currentEditingId = editingId;
    } else {
        title.textContent = 'Upload Document';
        currentEditingId = null;
    }

    document.getElementById('doc-name').value = '';
    document.getElementById('doc-description').value = '';
    document.getElementById('doc-file').value = null;

    modal.classList.add('active');
}

function closeDocumentModal() {
    document.getElementById('documentModal').classList.remove('active');
    currentEditingId = null;
}

document.getElementById('documentModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeDocumentModal();
    }
});

// ================================================================
// OPEN EDIT DOCUMENT
// ================================================================

async function openEditDocument(docId) {
    try {
        const doc = await db.collection('documents').doc(docId).get();
        if (!doc.exists) {
            showToast('⚠️ Document not found.', true);
            return;
        }

        const d = doc.data();
        openDocumentModal(docId);
        document.getElementById('doc-name').value = d.name || '';
        document.getElementById('doc-description').value = d.description || '';
    } catch (error) {
        console.error('Error opening document for edit:', error);
        showToast('❌ Error loading document.', true);
    }
}

// ================================================================
// UPLOAD FILE TO SUPABASE
// ================================================================

async function uploadFileToSupabase(file, folder = 'documents') {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `${folder}/${fileName}`;
    const { data, error } = await window.supabaseClient.storage
        .from('documents')
        .upload(filePath, file);
    if (error) throw new Error('Upload failed: ' + error.message);
    return filePath;
}

// ================================================================
// DELETE FILE FROM SUPABASE
// ================================================================

async function deleteFileFromSupabase(filePath) {
    const { error } = await window.supabaseClient.storage
        .from('documents')
        .remove([filePath]);
    if (error) throw new Error('Delete failed: ' + error.message);
}

// ================================================================
// SUBMIT DOCUMENT
// ================================================================

async function submitDocument() {
    const name = document.getElementById('doc-name').value.trim();
    const description = document.getElementById('doc-description').value.trim();
    const fileInput = document.getElementById('doc-file');
    const file = fileInput.files && fileInput.files[0];

    if (!name) {
        showToast('⚠️ Please enter a document name.', true);
        return;
    }

    const saveBtn = document.getElementById('documentSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        let storagePath = null;
        let oldStoragePath = null;

        if (currentEditingId) {
            const oldDoc = await db.collection('documents').doc(currentEditingId).get();
            if (oldDoc.exists) {
                oldStoragePath = oldDoc.data().storagePath;
            }
        }

        if (file) {
            if (file.size > 20 * 1024 * 1024) {
                showToast('⚠️ File size exceeds 20MB limit.', true);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
                return;
            }
            storagePath = await uploadFileToSupabase(file);
        } else if (!currentEditingId) {
            showToast('⚠️ Please select a file to upload.', true);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
            return;
        }

        if (currentEditingId) {
            const updateData = {
                name,
                description,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (storagePath) {
                updateData.storagePath = storagePath;
                if (oldStoragePath) {
                    try {
                        await deleteFileFromSupabase(oldStoragePath);
                    } catch (e) {
                        console.warn('Old file not found:', e);
                    }
                }
            }
            await db.collection('documents').doc(currentEditingId).update(updateData);
            showToast('✅ Document updated successfully!');
        } else {
            if (!storagePath) {
                showToast('⚠️ Please select a file to upload.', true);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
                return;
            }
            await db.collection('documents').add({
                name,
                description,
                storagePath: storagePath,
                uploadedBy: userUid,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('✅ Document uploaded successfully!');
        }

        // Reset pagination and reload
        loadDocuments(false);
        closeDocumentModal();

    } catch (error) {
        console.error('Error saving document:', error);
        showToast('❌ Error saving document: ' + error.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

// ================================================================
// DELETE DOCUMENT
// ================================================================

async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return;

    try {
        const doc = await db.collection('documents').doc(docId).get();
        if (!doc.exists) {
            showToast('⚠️ Document not found.', true);
            return;
        }
        const d = doc.data();

        if (d.storagePath) {
            try {
                await deleteFileFromSupabase(d.storagePath);
            } catch (e) {
                console.warn('File not found in storage:', e);
            }
        }

        await db.collection('documents').doc(docId).delete();

        showToast('Document deleted successfully!');
        // Reset pagination and reload
        loadDocuments(false);

    } catch (error) {
        console.error('Error deleting document:', error);
        showToast('❌ Error deleting document.', true);
    }
}

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