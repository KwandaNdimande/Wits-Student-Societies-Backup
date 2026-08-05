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
if (!userUid) {
    window.location.href = '/login.html';
}

let currentRequestId = null;
let allRequests = [];
let filteredRequests = [];
let currentPage = 1;
const pageSize = 5;

// Status colors
const statusColors = {
    "Submitted": "status-submitted",
    "Under Review": "status-under-review",
    "Approved": "status-approved",
    "Rejected": "status-rejected",
    "Revision Required": "status-revision",
    "Resubmitted": "status-under-review"
};

// Document labels
const docLabels = {
    'budgetForm': 'Budget Form',
    'meetingMinutes': 'Meeting Minutes',
    'vendorQuotation': 'Vendor Quotation'
};

// Load requests
async function loadRequests() {
    try {
        const requestsSnapshot = await db.collection('requests')
            .where('submittedBy', '==', userUid)
            .orderBy('submittedAt', 'desc')
            .get();

        allRequests = [];
        requestsSnapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
        });

        filteredRequests = [...allRequests];
        currentPage = 1;
        renderTable();

    } catch (error) {
        console.error('Error loading requests:', error);
        document.getElementById('requests-container').innerHTML = '<p style="color:#dc3545;text-align:center;padding:40px;">Error loading requests. Please try again.</p>';
    }
}

// Search function
function searchRequests() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase().trim() || '';
    
    if (searchTerm === '') {
        filteredRequests = [...allRequests];
    } else {
        filteredRequests = allRequests.filter(r => 
            (r.itemName && r.itemName.toLowerCase().includes(searchTerm)) ||
            (r.type && r.type.toLowerCase().includes(searchTerm)) ||
            (r.status && r.status.toLowerCase().includes(searchTerm))
        );
    }
    
    currentPage = 1;
    renderTable();
}

// Render table with pagination
function renderTable() {
    const container = document.getElementById('requests-container');
    const totalItems = filteredRequests.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = filteredRequests.slice(startIndex, endIndex);

    // Update results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = `Showing ${totalItems > 0 ? startIndex + 1 : 0}-${endIndex} of ${totalItems} requests`;
    }

    if (totalItems === 0) {
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">
                    <p>No requests found.</p>
                    <a href="/leader/new-request.html">Submit Your First Request</a>
                </div>
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Request</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pageItems.forEach((r, index) => {
        const num = startIndex + index + 1;
        const statusClass = statusColors[r.status] || 'status-submitted';
        const isRevision = r.status === 'Revision Required';
        const hasOfficerComment = r.officerComment && r.officerComment !== '';
        
        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${num}</td>
                <td class="strong">${r.itemName || r.name || 'Untitled'}</td>
                <td style="color:#6c757d;">${r.type || 'N/A'}</td>
                <td>R${r.amount ? r.amount.toLocaleString() : '0'}</td>
                <td style="color:#6c757d;">${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <span class="status-badge ${statusClass}">${r.status || 'N/A'}</span>
                    ${hasOfficerComment ? `<br><span style="font-size:11px;color:#E65100;">📝 ${r.officerComment}</span>` : ''}
                </td>
                <td>
                    ${isRevision ? `<button class="btn-update" onclick="openUpdateModal('${r.id}')">Update Documents</button>` : '—'}
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div class="pagination">
                <span class="info">Showing ${startIndex + 1}-${endIndex} of ${totalItems} requests</span>
                <div class="pages">
                    <button onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>
    `;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) html += `<span class="ellipsis">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="ellipsis">…</span>`;
        html += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    html += `
                    <button onclick="changePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
}

// ============ UPDATE DOCUMENTS MODAL ============

async function openUpdateModal(requestId) {
    currentRequestId = requestId;
    
    try {
        const docRef = await db.collection('requests').doc(requestId).get();
        if (!docRef.exists) {
            alert('Request not found.');
            return;
        }

        const data = docRef.data();
        const documents = data.documents || {};
        const itemName = data.itemName || 'Request';
        const officerComment = data.officerComment || '';

        let modalBody = `
            <p style="color:#6c757d;font-size:14px;margin-bottom:16px;">
                <strong>Request:</strong> ${itemName}
            </p>
        `;

        if (officerComment) {
            modalBody += `
                <div style="background:#FFF3E0;padding:12px;border-radius:8px;margin-bottom:16px;">
                    <strong style="color:#E65100;">📝 Officer's Feedback:</strong>
                    <p style="color:#5A6B87;font-size:14px;margin:4px 0 0;">${officerComment}</p>
                </div>
            `;
        }

        modalBody += `
            <p style="color:#E65100;font-size:14px;margin-bottom:16px;background:#FFF3E0;padding:10px;border-radius:6px;">
                ⚠️ Please upload corrected documents below.
            </p>
        `;

        const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
        
        docOrder.forEach(key => {
            const doc = documents[key];
            const label = docLabels[key] || key;
            const currentFile = doc ? doc.fileName : 'No file uploaded';
            
            modalBody += `
                <div class="doc-item">
                    <div class="doc-name">${label}</div>
                    <div class="doc-detail">Current: ${currentFile}</div>
                    <div class="file-input">
                        <input type="file" id="file_${key}" accept=".pdf" />
                        <span style="font-size:12px;color:#6c757d;">Upload new version (PDF only)</span>
                    </div>
                </div>
            `;
        });

        modalBody += `
            <div class="comment-area">
                <label style="font-weight:600;font-size:13px;color:var(--text-600);">Add Comment (Optional)</label>
                <textarea id="updateComment" placeholder="Describe the changes you've made..."></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="submitUpdate()">Resubmit</button>
                <button class="btn btn-secondary" onclick="closeUpdateModal()">Cancel</button>
            </div>
        `;

        document.getElementById('modalTitle').textContent = 'Update Documents';
        document.getElementById('modalBody').innerHTML = modalBody;
        document.getElementById('updateModal').classList.add('active');

    } catch (error) {
        console.error('Error loading documents:', error);
        alert('Error loading documents: ' + error.message);
    }
}

// ============ SUBMIT UPDATE ============

async function submitUpdate() {
    if (!currentRequestId) return;

    const btn = document.querySelector('#modalBody .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        const docRef = await db.collection('requests').doc(currentRequestId).get();
        const data = docRef.data();
        const currentDocs = data.documents || {};
        const updatedDocs = { ...currentDocs };

        const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
        let hasUpdate = false;

        docOrder.forEach(key => {
            const fileInput = document.getElementById(`file_${key}`);
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                const currentVersion = updatedDocs[key] ? (updatedDocs[key].version || 1) : 0;
                
                updatedDocs[key] = {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    version: currentVersion + 1,
                    isCurrent: true
                };
                hasUpdate = true;
            }
        });

        if (!hasUpdate) {
            alert('Please select at least one file to update.');
            btn.disabled = false;
            btn.textContent = 'Resubmit';
            return;
        }

        const comment = document.getElementById('updateComment')?.value || '';

        await db.collection('requests').doc(currentRequestId).update({
            documents: updatedDocs,
            status: 'Resubmitted',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            leaderComment: comment
        });

        closeUpdateModal();
        loadRequests();
        alert('✅ Documents updated successfully! Your request has been resubmitted for review.');

    } catch (error) {
        console.error('Error updating documents:', error);
        alert('Error updating documents: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Resubmit';
    }
}

// ============ MODAL FUNCTIONS ============

function closeUpdateModal() {
    document.getElementById('updateModal').classList.remove('active');
    currentRequestId = null;
}

// Close modal on overlay click
document.getElementById('updateModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeUpdateModal();
    }
});

// Make search function global
window.searchRequests = searchRequests;

// ============ LOAD DATA ============

loadRequests();