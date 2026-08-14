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
// HELPER: Force download from URL
// ================================================================
function forceDownload(url, fileName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ================================================================
// LOAD DOCUMENTS (READ-ONLY FOR LEADERS)
// ================================================================
async function loadDocuments() {
    try {
        const docsSnapshot = await db.collection('documents')
            .orderBy('name', 'asc')
            .get();

        const container = document.getElementById('documents-container');

        if (docsSnapshot.empty) {
            container.innerHTML = `<div class="no-docs">📭 No documents available.</div>`;
            return;
        }

        let html = '';
        docsSnapshot.forEach(doc => {
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
                <div class="doc-card">
                    <div class="doc-info">
                        <div class="doc-name">${escapeHtml(d.name)}</div>
                        <div class="doc-description">${escapeHtml(d.description || 'No description')}</div>
                    </div>
                    <div class="doc-actions">
                        <button class="btn-action btn-view" onclick="viewDocument('${publicUrl}')" ${!hasFile ? 'disabled' : ''}>
                            👁️ View
                        </button>
                        <button class="btn-action btn-download" onclick="downloadDocument('${publicUrl}', '${escapeHtml(fileName)}')" ${!hasFile ? 'disabled' : ''}>
                            ⬇ Download
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading documents:', error);
        document.getElementById('documents-container').innerHTML =
            `<div class="no-docs" style="color:#dc3545;">⚠️ Error loading documents.</div>`;
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
// HELPER FUNCTIONS
// ================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ================================================================
// LOAD DATA
// ================================================================
loadDocuments();