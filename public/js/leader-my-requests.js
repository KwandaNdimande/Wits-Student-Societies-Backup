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

// Status colors
const statusColors = {
    "Submitted": "status-submitted",
    "Under Review": "status-under-review",
    "Approved": "status-approved",
    "Rejected": "status-rejected",
    "Revision Required": "status-revision"
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
                <div style="text-align:center;padding:60px 0;border:1px solid #dee2e6;border-radius:8px;background:white;">
                    <p style="color:#6c757d;">No requests yet.</p>
                    <a href="/leader/new-request.html" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#003B5C;color:white;text-decoration:none;border-radius:6px;font-size:14px;">Submit Your First Request</a>
                </div>
            `;
            return;
        }

        let html = `
            <div style="border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:white;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead style="background:#f1f3f5;border-bottom:1px solid #dee2e6;">
                        <tr>
                            <th style="padding:12px 16px;text-align:left;font-weight:500;color:#6c757d;">Request</th>
                            <th style="padding:12px 16px;text-align:left;font-weight:500;color:#6c757d;">Type</th>
                            <th style="padding:12px 16px;text-align:left;font-weight:500;color:#6c757d;">Amount</th>
                            <th style="padding:12px 16px;text-align:left;font-weight:500;color:#6c757d;">Date</th>
                            <th style="padding:12px 16px;text-align:left;font-weight:500;color:#6c757d;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        requestsSnapshot.forEach(doc => {
            const r = doc.data();
            const statusClass = statusColors[r.status] || 'status-submitted';
            html += `
                <tr style="border-bottom:1px solid #f1f3f5;">
                    <td style="padding:12px 16px;font-weight:500;">${r.itemName}</td>
                    <td style="padding:12px 16px;color:#6c757d;">${r.type}</td>
                    <td style="padding:12px 16px;">R${r.amount.toLocaleString()}</td>
                    <td style="padding:12px 16px;color:#6c757d;">${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                    <td style="padding:12px 16px;">
                        <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;background:#cfe2ff;color:#004085;" class="${statusClass}">${r.status}</span>
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

// Load data
loadRequests();