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

        const container = document.getElementById('requests-container');
        
        if (requestsSnapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No requests yet.</p>
                    <a href="/leader/new-request.html">Submit Your First Request</a>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
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

        requestsSnapshot.forEach(doc => {
            const r = doc.data();
            const statusClass = statusColors[r.status] || 'status-submitted';
            const isRevision = r.status === 'Revision Required';
            
            html += `
                <tr>
                    <td class="strong">${r.itemName}</td>
                    <td style="color:#6c757d;">${r.type}</td>
                    <td>R${r.amount ? r.amount.toLocaleString() : '0'}</td>
                    <td style="color:#6c757d;">${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${r.status || 'N/A'}</span>
                    </td>
                    <td>
                        ${isRevision ? `<button class="btn-update" onclick="openUpdateModal('${doc.id}')">Update Documents</button>` : '—'}
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

        let modalBody = `
            <p style="color:#6c757d;font-size:14px;margin-bottom:16px;">
                <strong>Request:</strong> ${itemName}
            </p>
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

        // Check each file input
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

        // Get comment
        const comment = document.getElementById('updateComment')?.value || '';

        // Update request
        await db.collection('requests').doc(currentRequestId).update({
            documents: updatedDocs,
            status: 'Resubmitted',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            leaderComment: comment,
            revisionHistory: firebase.firestore.FieldValue.arrayUnion({
                action: 'Resubmitted',
                comment: comment,
                timestamp: new Date().toISOString(),
                by: 'leader'
            })
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

// ============ LOAD DATA ============

loadRequests();