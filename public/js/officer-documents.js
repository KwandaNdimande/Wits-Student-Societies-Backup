// ---------- SUPABASE INITIALIZATION (for consistency) ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';

// Create a global supabase client
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Firebase configuration
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
// LOAD DOCUMENTS
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
            html += `
                <div class="doc-card" data-id="${doc.id}">
                    <div class="doc-info">
                        <div class="doc-name">${escapeHtml(d.name)}</div>
                        <div class="doc-description">${escapeHtml(d.description || 'No description')}</div>
                    </div>
                    <div class="doc-actions">
                        <button class="btn-action btn-download-doc" onclick="downloadDocument('${doc.id}')">⬇ Download</button>
                        <button class="btn-action btn-edit-doc" onclick="openEditDocument('${doc.id}')">✏️ Edit</button>
                        <button class="btn-action btn-remove-doc" onclick="removeDocument('${doc.id}')">🗑️ Remove</button>
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
// OPEN MODAL
// ================================================================

function openDocumentModal(editingId) {
    const modal = document.getElementById('documentModal');
    const title = document.getElementById('documentModalTitle');

    if (editingId) {
        title.textContent = '✏️ Edit Document';
        currentEditingId = editingId;
    } else {
        title.textContent = '📤 Upload Document';
        currentEditingId = null;
    }

    // Reset form
    document.getElementById('doc-name').value = '';
    document.getElementById('doc-description').value = '';
    document.getElementById('doc-file').value = null;

    modal.classList.add('active');
}

function closeDocumentModal() {
    document.getElementById('documentModal').classList.remove('active');
    currentEditingId = null;
}

// Close modal on overlay click
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
        // File input cannot be populated for security reasons

    } catch (error) {
        console.error('Error opening document for edit:', error);
        showToast('❌ Error loading document.', true);
    }
}

// ================================================================
// SUBMIT DOCUMENT (Upload or Edit)
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
    saveBtn.textContent = '⏳ Saving...';

    try {
        let storagePath = null;
        let downloadUrl = null;
        let fileName = null;

        // Upload file if provided
        if (file) {
            if (file.type !== 'application/pdf') {
                showToast('⚠️ Only PDF files are accepted.', true);
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Save';
                return;
            }

            // Max file size 10MB
            if (file.size > 10 * 1024 * 1024) {
                showToast('⚠️ File size exceeds 10MB limit.', true);
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Save';
                return;
            }

            const timestamp = Date.now();
            fileName = file.name;
            storagePath = `documents/${timestamp}_${fileName}`;
            const storageRef = firebase.storage().ref().child(storagePath);
            const uploadTask = await storageRef.put(file);
            downloadUrl = await storageRef.getDownloadURL();
        }

        if (currentEditingId) {
            // Edit existing document
            const updateData = {
                name,
                description,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Only update file info if a new file was uploaded
            if (storagePath) {
                // Delete old file from storage if exists
                const oldDoc = await db.collection('documents').doc(currentEditingId).get();
                const oldData = oldDoc.data();
                if (oldData && oldData.storagePath) {
                    try {
                        await firebase.storage().ref().child(oldData.storagePath).delete();
                    } catch (e) {
                        console.warn('Old file not found or already deleted:', e);
                    }
                }
                updateData.storagePath = storagePath;
                updateData.fileName = fileName;
                updateData.downloadUrl = downloadUrl;
            }

            await db.collection('documents').doc(currentEditingId).update(updateData);
            showToast('✅ Document updated successfully!');

        } else {
            // New document
            await db.collection('documents').add({
                name,
                description,
                storagePath: storagePath || null,
                fileName: fileName || null,
                downloadUrl: downloadUrl || null,
                uploadedBy: userUid,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('✅ Document uploaded successfully!');
        }

        closeDocumentModal();
        loadDocuments();

    } catch (error) {
        console.error('Error saving document:', error);
        showToast('❌ Error saving document: ' + error.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save';
    }
}

// ================================================================
// DOWNLOAD DOCUMENT
// ================================================================

async function downloadDocument(docId) {
    try {
        const doc = await db.collection('documents').doc(docId).get();
        if (!doc.exists) {
            showToast('⚠️ Document not found.', true);
            return;
        }

        const d = doc.data();

        // Try to use stored download URL
        if (d.downloadUrl) {
            window.open(d.downloadUrl, '_blank');
            return;
        }

        // Fallback: get from storage path
        if (d.storagePath) {
            const url = await firebase.storage().ref().child(d.storagePath).getDownloadURL();
            window.open(url, '_blank');
            return;
        }

        showToast('⚠️ No file available for this document.', true);

    } catch (error) {
        console.error('Error downloading document:', error);
        showToast('❌ Error downloading document.', true);
    }
}

// ================================================================
// REMOVE DOCUMENT
// ================================================================

async function removeDocument(docId) {
    if (!confirm('🗑️ Are you sure you want to remove this document? This cannot be undone.')) return;

    try {
        // Get document data first to delete file from storage
        const doc = await db.collection('documents').doc(docId).get();
        const d = doc.data();

        // Delete file from Firebase Storage if exists
        if (d && d.storagePath) {
            try {
                await firebase.storage().ref().child(d.storagePath).delete();
            } catch (e) {
                console.warn('File not found in storage, proceeding with Firestore deletion:', e);
            }
        }

        // Delete Firestore document
        await db.collection('documents').doc(docId).delete();

        showToast('🗑️ Document removed successfully!');
        loadDocuments();

    } catch (error) {
        console.error('Error removing document:', error);
        showToast('❌ Error removing document.', true);
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