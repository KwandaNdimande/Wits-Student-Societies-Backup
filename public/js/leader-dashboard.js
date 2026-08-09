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

// Load dashboard data
async function loadDashboard() {
    try {
        const requestsSnapshot = await db.collection('requests')
            .where('submittedBy', '==', userUid)
            .orderBy('submittedAt', 'desc')
            .get();

        let stats = {
            submitted: 0,
            underReview: 0,
            approved: 0,
            rejected: 0,
            revisionRequired: 0
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
                case 'Revision Required':
                    stats.revisionRequired++;
                    break;
            }
        });

        document.querySelector('.stat-card.blue .stat-number').textContent = stats.submitted;
        document.querySelector('.stat-card.yellow .stat-number').textContent = stats.underReview;
        document.querySelector('.stat-card.green .stat-number').textContent = stats.approved;
        document.querySelector('.stat-card.red .stat-number').textContent = stats.rejected;
        document.querySelector('.stat-card.orange .stat-number').textContent = stats.revisionRequired;

        // set welcome name
        const welcome = localStorage.getItem('userName') || '';
        if (welcome) {
            const h = document.getElementById('welcomeHeading');
            if (h) h.textContent = `Welcome, ${welcome}`;
        }

        const recentContainer = document.querySelector('.recent-section');
        if (recentRequests.length > 0) {
            // highlight most recent
            const sorted = recentRequests.sort((a,b) => {
                const ta = a.submittedAt && a.submittedAt.seconds ? a.submittedAt.seconds : 0;
                const tb = b.submittedAt && b.submittedAt.seconds ? b.submittedAt.seconds : 0;
                return tb - ta;
            });
            const latest = sorted[0];
            const others = sorted.slice(1,5);

            const latestName = latest.itemName || latest.name || latest.title || latest.requestName || 'Untitled Request';
            const badgeClass = latest.status === 'Approved' ? 'green' : latest.status === 'Rejected' ? 'red' : latest.status === 'Under Review' ? 'yellow' : latest.status === 'Revision Required' ? 'orange' : 'blue';

            let html = `<h2>Most Recent</h2>
                <div style="border:1px solid #e6eef8;border-radius:10px;padding:16px;margin-bottom:12px;background:#fff;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:16px;font-weight:700;color:#0B1F3A;">${latestName}</div>
                        <div style="color:#5A6B87;margin-top:6px;">${latest.societyName || ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="display:inline-block;padding:6px 12px;border-radius:20px;background:var(--surface);border:1px solid var(--border);font-weight:700;color:var(--text-600);">${latest.status}</div>
                    </div>
                </div>`;

            if (others.length > 0) {
                html += '<h3 style="margin-top:8px;margin-bottom:8px;color:var(--text-500);">Recent</h3>';
                others.forEach(r => {
                    const name = r.itemName || r.name || r.title || 'Untitled Request';
                    html += `<div style="border-bottom:1px solid #eee;padding:10px 0;display:flex;justify-content:space-between;align-items:center;">
                        <div style="font-weight:600;color:#0B1F3A;">${name}<div style="font-size:13px;color:#6c757d;">${r.societyName || ''}</div></div>
                        <div style="color:#6c757d;">${r.status}</div>
                    </div>`;
                });
            }

            recentContainer.innerHTML = html;
        } else {
            recentContainer.innerHTML = '<h2>Recent Requests</h2><p style="color:#6c757d;font-size:14px;">No requests submitted yet.</p>';
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

loadDashboard();