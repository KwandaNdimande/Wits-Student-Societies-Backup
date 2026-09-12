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
// CURRENT FILE STATE (edit mode)
// ================================================================
let currentFilePublicUrl = null;
let currentFileName = null;
let currentFileSize = null;

// ================================================================
// EDIT VALIDATION STATE
// ================================================================
let initialName = '';
let initialDescription = '';
let initialFilePath = '';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ================================================================
// TOAST NOTIFICATION
// ================================================================
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
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
// ASTERISK HELPERS
// ================================================================
function setAsterisk(id, visible) {
    const el = document.getElementById(id);
    if (!el) return;
    if (visible) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

// ================================================================
// FIELD ERROR HELPERS
// ================================================================
function showFileError(message) {
    const err = document.getElementById('doc-file-error');
    const input = document.getElementById('doc-file');
    if (err) {
        err.textContent = message;
        err.classList.add('show');
    }
    if (input) input.classList.add('input-error');
}

function hideFileError() {
    const err = document.getElementById('doc-file-error');
    const input = document.getElementById('doc-file');
    if (err) {
        err.classList.remove('show');
        err.textContent = '';
    }
    if (input) input.classList.remove('input-error');
}

function showNameError() {
    const input = document.getElementById('doc-name');
    if (input) input.classList.add('input-error');
}

function hideNameError() {
    const input = document.getElementById('doc-name');
    if (input) input.classList.remove('input-error');
}

// ================================================================
// FORCE DOWNLOAD
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
// RENDER DOCUMENTS (TABLE)
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

        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${rowNum}</td>
                <td>
                    <span class="doc-name">${escapeHtml(d.name)}</span>
                </td>
                <td>
                    <div class="doc-actions">
                        <button class="btn-action btn-download-doc" onclick="downloadDocument('${publicUrl}', '${escapeHtml(fileName)}')" ${!hasFile ? 'disabled' : ''}>
                            ⬇ Download
                        </button>
                        <button class="btn-action btn-edit-doc" onclick="openEditDocument('${doc.id}')">Edit</button>
                        <button class="btn-action btn-delete-doc" onclick="deleteDocument('${doc.id}')">Delete</button>
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
                return `
                    <tr>
                        <td style="color:#6c757d;font-weight:500;">${rowNum}</td>
                        <td>
                            <span class="doc-name">${escapeHtml(d.name)}</span>
                        </td>
                        <td>
                            <div class="doc-actions">
                                <button class="btn-action btn-download-doc" onclick="downloadDocument('${publicUrl}', '${escapeHtml(fileName)}')" ${!hasFile ? 'disabled' : ''}>
                                    ⬇ Download
                                </button>
                                <button class="btn-action btn-edit-doc" onclick="openEditDocument('${doc.id}')">Edit</button>
                                <button class="btn-action btn-delete-doc" onclick="deleteDocument('${doc.id}')">Delete</button>
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
// DOWNLOAD
// ================================================================
function downloadDocument(url, fileName) {
    if (url && url !== '#') {
        forceDownload(url, fileName);
    } else {
        alert('No file available to download.');
    }
}

// ================================================================
// VIEW CURRENT FILE
// ================================================================
function viewCurrentFile() {
    if (currentFilePublicUrl && currentFilePublicUrl !== '#') {
        window.open(currentFilePublicUrl, '_blank');
    } else {
        alert('No file available to view.');
    }
}

// ================================================================
// VALIDITY CHECK (controls Save button state)
// ================================================================
function isFormValid() {
    const name = document.getElementById('doc-name')?.value.trim() || '';
    const fileInput = document.getElementById('doc-file');
    const hasNewFile = fileInput?.files && fileInput.files.length > 0;

    // Name always required
    if (!name) return false;

    // In new-upload mode (no currentEditingId), a file is required
    if (!currentEditingId) {
        if (!hasNewFile) return false;
        // Also enforce max size
        if (fileInput.files[0].size > MAX_FILE_SIZE) return false;
        return true;
    }

    // Edit mode: needs at least one change
    const nameChanged = name !== initialName;
    const descChanged = (document.getElementById('doc-description')?.value.trim() || '') !== initialDescription;
    const fileChanged = hasNewFile;

    if (!nameChanged && !descChanged && !fileChanged) return false;

    // If a new file was selected, enforce max size
    if (hasNewFile && fileInput.files[0].size > MAX_FILE_SIZE) return false;

    return true;
}

// ================================================================
// UPDATE UI STATE (asterisks, button, warnings)
// ================================================================
function updateFormState() {
    const nameInput = document.getElementById('doc-name');
    const fileInput = document.getElementById('doc-file');
    const saveBtn = document.getElementById('documentSaveBtn');
    const warning = document.getElementById('edit-warning');
    const isEditMode = !!currentEditingId;

    // Asterisk: doc name
    const hasName = nameInput && nameInput.value.trim().length > 0;
    setAsterisk('req-doc-name', !hasName);

    // Asterisk: file (only in new-upload mode)
    if (isEditMode) {
        setAsterisk('req-doc-file', false); // hide in edit mode
    } else {
        const hasFile = fileInput?.files && fileInput.files.length > 0;
        setAsterisk('req-doc-file', !hasFile);
    }

    // Live name error clear (only clear if user fixes it)
    if (nameInput && nameInput.classList.contains('input-error') && hasName) {
        hideNameError();
    }

    // Live file error clear
    if (fileInput && fileInput.classList.contains('input-error')) {
        const f = fileInput.files?.[0];
        if (f && f.size <= MAX_FILE_SIZE) {
            hideFileError();
        }
    }

    // Edit warning (edit mode + no changes)
    if (isEditMode) {
        const nameChanged = (nameInput?.value.trim() || '') !== initialName;
        const descChanged = (document.getElementById('doc-description')?.value.trim() || '') !== initialDescription;
        const fileChanged = fileInput?.files && fileInput.files.length > 0;
        const hasChanges = nameChanged || descChanged || fileChanged;
        if (warning) {
            if (hasChanges) warning.classList.remove('show');
            else warning.classList.add('show');
        }
    } else {
        if (warning) warning.classList.remove('show');
    }

    // Save button state
    if (saveBtn) {
        saveBtn.disabled = !isFormValid();
    }
}

// ================================================================
// HANDLE FILE CHANGE
// ================================================================
function handleFileChange(input) {
    const file = input.files && input.files[0];
    const indicator = document.getElementById('current-file-indicator');
    const fileNameEl = document.getElementById('current-file-name');
    const fileSizeEl = document.getElementById('current-file-size');

    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = `(${sizeMB} MB)`;
        currentFilePublicUrl = null;
        indicator.classList.remove('hidden');

        // Size check immediate
        if (file.size > MAX_FILE_SIZE) {
            showFileError('Error: File exceeds the 20MB limit');
        } else {
            hideFileError();
        }
    } else {
        indicator.classList.add('hidden');
        hideFileError();
    }

    updateFormState();
}

// ================================================================
// OPEN MODAL (upload / edit)
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
    document.getElementById('current-file-indicator').classList.add('hidden');
    hideFileError();
    hideNameError();

    const saveBtn = document.getElementById('documentSaveBtn');
    const warning = document.getElementById('edit-warning');
    saveBtn.disabled = true;
    warning.classList.remove('show');

    modal.classList.add('active');

    // Set initial state: asterisks all visible, button disabled
    updateFormState();
}

function closeDocumentModal() {
    document.getElementById('documentModal').classList.remove('active');
    currentEditingId = null;
    currentFilePublicUrl = null;
    currentFileName = null;
    currentFileSize = null;
    document.getElementById('current-file-indicator').classList.add('hidden');
    hideFileError();
    hideNameError();

    const saveBtn = document.getElementById('documentSaveBtn');
    const warning = document.getElementById('edit-warning');
    saveBtn.disabled = true;
    warning.classList.remove('show');
}

document.getElementById('documentModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeDocumentModal();
    }
});

// Attach live listeners once (modal HTML is static)
document.getElementById('doc-name').addEventListener('input', updateFormState);
document.getElementById('doc-description').addEventListener('input', updateFormState);

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

        initialName = d.name || '';
        initialDescription = d.description || '';

        const indicator = document.getElementById('current-file-indicator');
        const fileNameEl = document.getElementById('current-file-name');
        const fileSizeEl = document.getElementById('current-file-size');

        if (d.storagePath) {
            const { data } = window.supabaseClient.storage
                .from('documents')
                .getPublicUrl(d.storagePath);
            currentFilePublicUrl = data.publicUrl;
            currentFileName = d.storagePath.split('/').pop();
            initialFilePath = d.storagePath;

            if (d.fileSize) {
                const sizeMB = (d.fileSize / (1024 * 1024)).toFixed(2);
                currentFileSize = d.fileSize;
                fileSizeEl.textContent = `(${sizeMB} MB)`;
            } else {
                fileSizeEl.textContent = '';
            }

            fileNameEl.textContent = currentFileName;
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
            initialFilePath = '';
        }

        // Initial state for edit mode: Save disabled (no changes yet)
        updateFormState();

    } catch (error) {
        console.error('Error opening document for edit:', error);
        showToast('❌ Error loading document.', true);
    }
}

// ================================================================
// UPLOAD / DELETE STORAGE
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
    const nameInput = document.getElementById('doc-name');
    const fileInput = document.getElementById('doc-file');

    const name = nameInput.value.trim();
    const description = document.getElementById('doc-description').value.trim();
    const file = fileInput.files && fileInput.files[0];

    // Name empty → red border only (asterisk handles visual)
    if (!name) {
        showNameError();
        return;
    }

    // New upload mode: file required
    if (!currentEditingId && !file) {
        // Asterisk + disabled button handle this — no inline message per Q7=B
        return;
    }

    // File size check
    if (file && file.size > MAX_FILE_SIZE) {
        showFileError('Error: File exceeds the 20MB limit');
        return;
    }

    // Edit mode: require a change
    if (currentEditingId) {
        const nameChanged = name !== initialName;
        const descChanged = description !== initialDescription;
        const fileChanged = !!file;
        if (!nameChanged && !descChanged && !fileChanged) {
            showToast('⚠️ No changes made to save.', true);
            return;
        }
    }

    const saveBtn = document.getElementById('documentSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        let storagePath = null;
        let oldStoragePath = null;
        let fileSize = null;

        if (currentEditingId) {
            const oldDoc = await db.collection('documents').doc(currentEditingId).get();
            if (oldDoc.exists) {
                oldStoragePath = oldDoc.data().storagePath;
            }
        }

        if (file) {
            fileSize = file.size;
            storagePath = await uploadFileToSupabase(file);
        }

        if (currentEditingId) {
            const updateData = {
                name,
                description,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (storagePath) {
                updateData.storagePath = storagePath;
                updateData.fileSize = fileSize;
                if (oldStoragePath) {
                    try {
                        await deleteFileFromSupabase(oldStoragePath);
                    } catch (e) {
                        console.warn('Old file not found:', e);
                    }
                }
            }
            await db.collection('documents').doc(currentEditingId).update(updateData);
            showToast('Document updated successfully!');
        } else {
            await db.collection('documents').add({
                name,
                description,
                storagePath: storagePath,
                fileSize: fileSize,
                uploadedBy: userUid,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('✅ Document uploaded successfully!');
        }

        closeDocumentModal();

        setTimeout(() => {
            loadDocuments(false);
        }, 250);

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

        setTimeout(() => {
            loadDocuments(false);
        }, 250);

    } catch (error) {
        console.error('Error deleting document:', error);
        showToast('❌ Error deleting document.', true);
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

        document.getElementById('info-name').textContent = d.name || '-';
        document.getElementById('info-description').textContent = d.description || 'No description';

        let dateStr = 'Unknown';
        if (d.uploadedAt) {
            const ts = d.uploadedAt.seconds ? d.uploadedAt.seconds * 1000 : d.uploadedAt;
            dateStr = new Date(ts).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        document.getElementById('info-date').textContent = dateStr;

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
// HELPER
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