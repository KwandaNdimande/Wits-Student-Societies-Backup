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

// Status colors
const statusColors = {
    "Submitted": "status-submitted",
    "Under Review": "status-under-review",
    "Approved": "status-approved",
    "Rejected": "status-rejected",
    "Revision Required": "status-revision",
    "Resubmitted": "status-resubmitted"
};

const statusOptions = ["Submitted", "Under Review", "Approved", "Rejected", "Revision Required"];

// Document type labels
const docLabels = {
    'budgetForm': 'Budget Form',
    'meetingMinutes': 'Meeting Minutes',
    'vendorQuotation': 'Vendor Quotation'
};

// Load all requests
async function loadRequests() {
    try {
        const requestsSnapshot = await db.collection('requests')
            .orderBy('submittedAt', 'desc')
            .get();

        const container = document.getElementById('requests-container');
        
        if (requestsSnapshot.empty) {
            container.innerHTML = '<div class="empty-state">No requests found.</div>';
            return;
        }

        let html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
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

        const requests = [];
        requestsSnapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() });
        });

        requests.forEach(r => {
            const statusClass = statusColors[r.status] || 'status-submitted';
            const isLocked = r.status === 'Approved' || r.status === 'Rejected';
            
            const optionsHTML = statusOptions.map(s => 
                `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`
            ).join('');

            // Check if documents exist
            const hasDocs = r.documents && Object.keys(r.documents).length > 0;

            html += `
                <tr>
                    <td class="strong">${r.societyName || 'Unknown'}</td>
                    <td>${r.itemName}</td>
                    <td style="color:#6c757d;">${r.type}</td>
                    <td>R${r.amount ? r.amount.toLocaleString() : '0'}</td>
                    <td style="color:#6c757d;">${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${r.status || 'N/A'}</span>
                    </td>
                    <td>
                        <button class="btn-view" onclick="viewDocuments('${r.id}')">
                            ${hasDocs ? '📄 View' : 'No Docs'}
                        </button>
                    </td>
                    <td>
                        <select class="status-select" onchange="updateStatus('${r.id}', this.value)" ${isLocked ? 'disabled' : ''}>
                            ${optionsHTML}
                        </select>
                        ${isLocked ? '<span style="font-size:11px;color:#6c757d;display:block;">🔒 Locked</span>' : ''}
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
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading requests:', error);
        document.getElementById('requests-container').innerHTML = '<p style="color:#dc3545;">Error loading requests. Please try again.</p>';
    }
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
            modalBody = Object.entries(documents).map(([key, doc]) => {
                const label = docLabels[key] || key;
                const fileName = doc.fileName || 'No file';
                const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt.seconds * 1000).toLocaleString() : 'N/A';
                const version = doc.version || 1;
                const isCurrent = doc.isCurrent !== false;

                return `
                    <div class="doc-item">
                        <div class="doc-name">📄 ${label}</div>
                        <div class="doc-detail">File: ${fileName}</div>
                        <div class="doc-detail">Uploaded: ${uploadedAt}</div>
                        <div class="doc-version">Version: ${version}</div>
                        <span class="doc-status ${isCurrent ? 'current' : 'old'}">${isCurrent ? '✅ Current' : '📌 Old Version'}</span>
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
        // Get request data first
        const requestDoc = await db.collection('requests').doc(requestId).get();
        const requestData = requestDoc.data();
        
        if (!requestData) {
            alert('Request not found.');
            return;
        }

        // Check if status is locked
        if (requestData.status === 'Approved' || requestData.status === 'Rejected') {
            alert('This request is locked. Cannot change status.');
            loadRequests();
            return;
        }

        // Update status
        await db.collection('requests').doc(requestId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Send email notification to leader
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
                // Don't block the status update if email fails
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