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

async function loadDashboard() {
    try {
        const requestsSnapshot = await db.collection('requests').get();

        let stats = {
            submitted: 0,
            underReview: 0,
            approved: 0,
            rejected: 0
        };
        let recentRequests = [];

        requestsSnapshot.forEach(doc => {
            const data = doc.data();
            recentRequests.push({ id: doc.id, ...data });

            switch(data.status) {
                case 'Submitted':
                    stats.submitted++;
                    break;
                case 'Under Review':
                    stats.underReview++;
                    break;
                case 'Approved':
                    stats.approved++;
                    break;
                case 'Rejected':
                    stats.rejected++;
                    break;
            }
        });

        document.querySelector('.stat-card.blue .stat-number').textContent = stats.submitted;
        document.querySelector('.stat-card.yellow .stat-number').textContent = stats.underReview;
        document.querySelector('.stat-card.green .stat-number').textContent = stats.approved;
        document.querySelector('.stat-card.red .stat-number').textContent = stats.rejected;

        const recentContainer = document.querySelector('.recent-section');
        if (recentRequests.length > 0) {
            const recent = recentRequests.slice(0, 5);
            let html = '<h2>Recent Requests</h2>';
            recent.forEach(r => {
                const requestName = r.itemName || r.name || r.title || r.requestName || 'Untitled Request';
                html += `
                    <div style="border-bottom:1px solid #eee;padding:12px 0;">
                        <strong>${requestName}</strong>
                        <span style="color:#6c757d;font-size:14px;margin-left:8px;">- ${r.societyName || 'Unknown'}</span>
                        <span style="float:right;color:#6c757d;font-size:14px;">${r.status}</span>
                    </div>
                `;
            });
            recentContainer.innerHTML = html;
        } else {
            recentContainer.innerHTML = '<h2>Recent Requests</h2><p style="color:#6c757d;font-size:14px;">No requests submitted yet.</p>';
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

loadDashboard();