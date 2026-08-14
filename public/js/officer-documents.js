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
            // Build public URL from the stored path (if any)
            let downloadUrl = '#';
            if (d.storagePath) {
                const { data } = window.supabaseClient.storage
                    .from('documents')
                    .getPublicUrl(d.storagePath);
                downloadUrl = data.publicUrl;
            }
            html += `
                <div class="doc-card" data-id="${doc.id}">
                    <div class="doc-info">
                        <div class="doc-name">${escapeHtml(d.name)}</div>
                        <div class="doc-description">${escapeHtml(d.description || 'No description')}</div>
                    </div>
                    <div class="doc-actions">
                        <button class="btn-action btn-download-doc" onclick="downloadDocument('${doc.id}')">⬇ Download</button>
                        <button class="btn-action btn-edit-doc" onclick="openEditDocument('${doc.id}')">Edit</button>
                        <button class="btn-action btn-remove-doc" onclick="removeDocument('${doc.id}')">Remove</button>
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
        title.textContent = 'Edit Document';
        currentEditingId = editingId;
        // Load existing data into modal (will be populated by openEditDocument)
    } else {
        title.textContent = 'Upload Document';
        currentEditingId = null;
    }

    // Reset form (except for edit, we fill later)
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
// SUBMIT DOCUMENT (Upload or Edit) - USING SUPABASE
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

        // If editing, fetch the existing document to get old storage path
        if (currentEditingId) {
            const oldDoc = await db.collection('documents').doc(currentEditingId).get();
            if (oldDoc.exists) {
                oldStoragePath = oldDoc.data().storagePath;
            }
        }

        // Upload new file if provided
        if (file) {
            if (file.type !== 'application/pdf') {
                showToast('⚠️ Only PDF files are accepted.', true);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                showToast('⚠️ File size exceeds 10MB limit.', true);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
                return;
            }
            storagePath = await uploadFileToSupabase(file);
        }

        if (currentEditingId) {
            // Update existing document
            const updateData = {
                name,
                description,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (storagePath) {
                updateData.storagePath = storagePath;
                // Delete old file if it exists
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
            // New document
            if (!storagePath) {
                showToast('⚠️ Please select a PDF file to upload.', true);
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

        closeDocumentModal();
        loadDocuments();

    } catch (error) {
        console.error('Error saving document:', error);
        showToast('❌ Error saving document: ' + error.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

// ================================================================
// DOWNLOAD DOCUMENT - USING SUPABASE PUBLIC URL
// ================================================================

async function downloadDocument(docId) {
    try {
        const doc = await db.collection('documents').doc(docId).get();
        if (!doc.exists) {
            showToast('⚠️ Document not found.', true);
            return;
        }

        const d = doc.data();
        if (!d.storagePath) {
            showToast('⚠️ No file available for this document.', true);
            return;
        }

        const { data } = window.supabaseClient.storage
            .from('documents')
            .getPublicUrl(d.storagePath);
        if (data && data.publicUrl) {
            window.open(data.publicUrl, '_blank');
        } else {
            showToast('⚠️ Could not generate download link.', true);
        }
    } catch (error) {
        console.error('Error downloading document:', error);
        showToast('❌ Error downloading document.', true);
    }
}

// ================================================================
// REMOVE DOCUMENT - DELETE FROM SUPABASE AND FIRESTORE
// ================================================================

async function removeDocument(docId) {
    if (!confirm('Are you sure you want to remove this document? This cannot be undone.')) return;

    try {
        // Get document data to get storage path
        const doc = await db.collection('documents').doc(docId).get();
        if (!doc.exists) {
            showToast('⚠️ Document not found.', true);
            return;
        }
        const d = doc.data();

        // Delete file from Supabase if exists
        if (d.storagePath) {
            try {
                await deleteFileFromSupabase(d.storagePath);
            } catch (e) {
                console.warn('File not found in storage:', e);
                // Continue to delete Firestore document
            }
        }

        // Delete Firestore document
        await db.collection('documents').doc(docId).delete();

        showToast('Document removed successfully!');
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