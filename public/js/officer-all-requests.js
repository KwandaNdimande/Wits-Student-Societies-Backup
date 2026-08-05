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
    "Resubmitted": "status-resubmitted"
};

const statusOptions = ["Submitted", "Under Review", "Approved", "Rejected"];

let currentFlagRequestId = null;

// Load all requests
async function loadRequests() {
    try {
        const requestsSnapshot = await db.collection('requests')
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
            (r.societyName && r.societyName.toLowerCase().includes(searchTerm)) ||
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
                <div class="empty-state">No requests found.</div>
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
                        <th>Society</th>
                        <th>Request</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Documents</th>
                        <th>Update Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pageItems.forEach((r, index) => {
        const num = startIndex + index + 1;
        const statusClass = statusColors[r.status] || 'status-submitted';
        const isLocked = r.status === 'Approved' || r.status === 'Rejected';
        const isRevisionLocked = r.status === 'Revision Required';
        const isResubmitted = r.status === 'Resubmitted';
        
        const optionsHTML = statusOptions.map(s => 
            `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`
        ).join('');

        const hasDocs = r.documents && Object.keys(r.documents).length > 0;
        const hasOfficerComment = r.status === 'Revision Required' && r.officerComment && r.officerComment !== '';

        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${num}</td>
                <td class="strong">${r.societyName || 'Unknown'}</td>
                <td>${r.itemName || r.name || 'Untitled'}</td>
                <td style="color:#6c757d;">${r.type || 'N/A'}</td>
                <td>R${r.amount ? r.amount.toLocaleString() : '0'}</td>
                <td style="color:#6c757d;">${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <span class="status-badge ${statusClass}">${r.status || 'N/A'}</span>
                    ${hasOfficerComment ? `<br><span style="font-size:11px;color:#E65100;">📝 ${r.officerComment}</span>` : ''}
                </td>
                <td>
                    <button class="btn-view" onclick="viewDocuments('${r.id}')">
                        ${hasDocs ? '📄 View' : 'No Docs'}
                    </button>
                </td>
                <td>
                    ${isRevisionLocked ? 
                        `<span class="waiting-text">⏳ Awaiting Resubmission</span>` :
                        `<select class="status-select" onchange="updateStatus('${r.id}', this.value)" ${isLocked ? 'disabled' : ''}>
                            ${optionsHTML}
                        </select>`
                    }
                    ${!isLocked && !isRevisionLocked ? `<button class="btn-flag" onclick="openFlagModal('${r.id}')">🚩 Flag</button>` : ''}
                    ${isResubmitted ? `<button class="btn-view" onclick="viewUpdatedDocuments('${r.id}')">📂 Compare</button>` : ''}
                </td>
                <td>
                    <button class="btn-delete" onclick="deleteRequest('${r.id}')">Delete</button>
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

// ============ VIEW DOCUMENTS ============

async function viewDocuments(requestId) {
    try {
        const docRef = await db.collection('requests').doc(requestId).get();
        if (!docRef.exists) {
            showModal('Request not found', '<p>No documents found for this request.</p>');
            return;
        }

        const data = docRef.data();
        const documents = data.documents || {};
        const itemName = data.itemName || 'Request';

        let modalBody = '';

        if (Object.keys(documents).length === 0) {
            modalBody = '<p class="no-docs">No documents uploaded for this request.</p>';
        } else {
            const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
            const docLabels = {
                'budgetForm': 'Budget Form',
                'meetingMinutes': 'Meeting Minutes',
                'vendorQuotation': 'Vendor Quotation'
            };

            modalBody = docOrder.map(key => {
                const doc = documents[key];
                if (!doc) {
                    return `
                        <div class="doc-item">
                            <div class="doc-name">${docLabels[key] || key}</div>
                            <div class="doc-detail">No file uploaded</div>
                        </div>
                    `;
                }
                const fileName = doc.fileName || 'No file';
                return `
                    <div class="doc-item">
                        <div class="doc-name">${docLabels[key] || key}</div>
                        <div class="doc-detail">${fileName}</div>
                    </div>
                `;
            }).join('');
        }

        showModal(`Documents - ${itemName}`, modalBody);

    } catch (error) {
        console.error('Error viewing documents:', error);
        alert('Error loading documents: ' + error.message);
    }
}

// ============ VIEW UPDATED DOCUMENTS (COMPARE) ============

async function viewUpdatedDocuments(requestId) {
    try {
        const docRef = await db.collection('requests').doc(requestId).get();
        if (!docRef.exists) {
            showModal('Request not found', '<p>No documents found for this request.</p>');
            return;
        }

        const data = docRef.data();
        const documents = data.documents || {};
        const itemName = data.itemName || 'Request';
        const officerComment = data.officerComment || '';
        const leaderComment = data.leaderComment || '';

        let modalBody = `
            <div style="margin-bottom:16px;padding:12px;background:#FFF3E0;border-radius:8px;">
                <strong style="color:#E65100;">📝 Revision Requested:</strong>
                <p style="color:#5A6B87;font-size:14px;margin:4px 0 0;">${officerComment || 'No comment provided'}</p>
            </div>
        `;

        if (leaderComment) {
            modalBody += `
                <div style="margin-bottom:16px;padding:12px;background:#E3F2FD;border-radius:8px;">
                    <strong style="color:#0D47A1;">📤 Leader's Note:</strong>
                    <p style="color:#5A6B87;font-size:14px;margin:4px 0 0;">${leaderComment}</p>
                </div>
            `;
        }

        if (Object.keys(documents).length === 0) {
            modalBody += '<p class="no-docs">No documents uploaded for this request.</p>';
        } else {
            const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
            const docLabels = {
                'budgetForm': 'Budget Form',
                'meetingMinutes': 'Meeting Minutes',
                'vendorQuotation': 'Vendor Quotation'
            };

            modalBody += '<h3 style="margin-top:12px;font-size:16px;color:var(--navy-900);">Updated Documents</h3>';
            
            modalBody += docOrder.map(key => {
                const doc = documents[key];
                if (!doc) {
                    return `
                        <div class="doc-item">
                            <div class="doc-name">${docLabels[key] || key}</div>
                            <div class="doc-detail">No file uploaded</div>
                        </div>
                    `;
                }
                const fileName = doc.fileName || 'No file';
                const version = doc.version || 1;
                const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt.seconds * 1000).toLocaleString() : 'N/A';
                return `
                    <div class="doc-item">
                        <div class="doc-name">${docLabels[key] || key}</div>
                        <div class="doc-detail">File: ${fileName}</div>
                        <div class="doc-detail">Version: ${version} • Uploaded: ${uploadedAt}</div>
                    </div>
                `;
            }).join('');
        }

        showModal(`Updated Documents - ${itemName}`, modalBody);

    } catch (error) {
        console.error('Error viewing updated documents:', error);
        alert('Error loading documents: ' + error.message);
    }
}

// ============ FLAG MODAL FUNCTIONS ============

function openFlagModal(requestId) {
    currentFlagRequestId = requestId;
    document.getElementById('flagComment').value = '';
    document.getElementById('flagModal').classList.add('active');
}

function closeFlagModal() {
    document.getElementById('flagModal').classList.remove('active');
    currentFlagRequestId = null;
}

// Close flag modal on overlay click
document.getElementById('flagModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFlagModal();
    }
});

// ============ SUBMIT FLAG ============

async function submitFlag() {
    if (!currentFlagRequestId) return;

    const comment = document.getElementById('flagComment').value.trim();
    const btn = document.querySelector('#flagModal .btn-danger');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        await db.collection('requests').doc(currentFlagRequestId).update({
            status: 'Revision Required',
            officerComment: comment || 'Revision required',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const requestDoc = await db.collection('requests').doc(currentFlagRequestId).get();
        const requestData = requestDoc.data();

        if (requestData.submittedBy) {
            try {
                const userDoc = await db.collection('users').doc(requestData.submittedBy).get();
                const userData = userDoc.data();
                
                if (userData && userData.email) {
                    await fetch('/api/send-status-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userData.email,
                            requestName: requestData.itemName || 'Your Request',
                            status: 'Revision Required',
                            officerComment: comment || 'Revision required'
                        })
                    });
                    console.log('Revision email sent to leader');
                }
            } catch (emailError) {
                console.error('Email error:', emailError);
            }
        }

        closeFlagModal();
        loadRequests();
        alert('✅ Request flagged for revision. Leader has been notified.');

    } catch (error) {
        console.error('Error flagging request:', error);
        alert('Error flagging request: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Flag Request';
    }
}

// ============ MODAL FUNCTIONS ============

function showModal(title, bodyHTML) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('docModal').classList.add('active');
}

function closeModal() {
    document.getElementById('docModal').classList.remove('active');
}

// Close modal on overlay click
document.getElementById('docModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// ============ UPDATE STATUS ============

async function updateStatus(requestId, newStatus) {
    try {
        const requestDoc = await db.collection('requests').doc(requestId).get();
        const requestData = requestDoc.data();
        
        if (!requestData) {
            alert('Request not found.');
            return;
        }

        if (requestData.status === 'Approved' || requestData.status === 'Rejected') {
            alert('This request is locked. Cannot change status.');
            loadRequests();
            return;
        }

        if (requestData.status === 'Revision Required') {
            alert('This request is waiting for leader to update documents. Cannot change status until resubmitted.');
            loadRequests();
            return;
        }

        await db.collection('requests').doc(requestId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (requestData.submittedBy) {
            try {
                const userDoc = await db.collection('users').doc(requestData.submittedBy).get();
                const userData = userDoc.data();
                
                if (userData && userData.email) {
                    await fetch('/api/send-status-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userData.email,
                            requestName: requestData.itemName || 'Your Request',
                            status: newStatus,
                            officerComment: ''
                        })
                    });
                    console.log('Status email sent to leader');
                }
            } catch (emailError) {
                console.error('Email error:', emailError);
            }
        }

        loadRequests();

    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status: ' + error.message);
    }
}

// ============ DELETE REQUEST ============

async function deleteRequest(requestId) {
    if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) return;

    try {
        await db.collection('requests').doc(requestId).delete();
        loadRequests();
    } catch (error) {
        console.error('Error deleting request:', error);
        alert('Error deleting request: ' + error.message);
    }
}

// ============ LOAD DATA ============

loadRequests();

// Make search function global for HTML
window.searchRequests = searchRequests;