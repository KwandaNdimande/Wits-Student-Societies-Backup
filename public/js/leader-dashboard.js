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

// Small helper: escape any user-supplied text that ends up in innerHTML
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Navigate to My Requests with the clicked request highlighted
function goToRequest(requestId) {
    if (!requestId) return;
    window.location.href = `/leader/my-requests.html?highlight=${encodeURIComponent(requestId)}`;
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

        // Set welcome name
        const welcome = localStorage.getItem('userName') || '';
        if (welcome) {
            const h = document.getElementById('welcomeHeading');
            if (h) h.textContent = `Welcome, ${welcome}`;
        }

        const recentContainer = document.querySelector('.recent-section');
        if (recentRequests.length > 0) {
            const sorted = recentRequests.sort((a,b) => {
                const ta = a.submittedAt && a.submittedAt.seconds ? a.submittedAt.seconds : 0;
                const tb = b.submittedAt && b.submittedAt.seconds ? b.submittedAt.seconds : 0;
                return tb - ta;
            });
            const latest = sorted[0];
            const others = sorted.slice(1,5);

            const latestName = latest.itemName || latest.name || latest.title || latest.requestName || 'Untitled Request';
            const latestId = latest.id;

            let html = `<h2>Most Recent</h2>
                <div class="recent-card"
                     tabindex="0"
                     role="button"
                     aria-label="Open request: ${escapeHtml(latestName)}"
                     data-request-id="${escapeHtml(latestId)}">
                    <div>
                        <div class="recent-card-name">${escapeHtml(latestName)}</div>
                        <div class="recent-card-society">${escapeHtml(latest.societyName || '')}</div>
                    </div>
                    <div>
                        <div class="recent-card-status">${escapeHtml(latest.status || '')}</div>
                    </div>
                </div>`;

            if (others.length > 0) {
                html += '<h3 class="recent-subheading">Recent</h3>';
                others.forEach(r => {
                    const name = r.itemName || r.name || r.title || 'Untitled Request';
                    html += `
                        <div class="recent-row"
                             tabindex="0"
                             role="button"
                             aria-label="Open request: ${escapeHtml(name)}"
                             data-request-id="${escapeHtml(r.id)}">
                            <div>
                                <div class="recent-row-name">${escapeHtml(name)}</div>
                                <div class="recent-row-society">${escapeHtml(r.societyName || '')}</div>
                            </div>
                            <div class="recent-row-status">${escapeHtml(r.status || '')}</div>
                        </div>`;
                });
            }

            recentContainer.innerHTML = html;

            // Wire click + keyboard activation on every clickable item
            recentContainer.querySelectorAll('[data-request-id]').forEach(el => {
                el.addEventListener('click', () => goToRequest(el.dataset.requestId));
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        goToRequest(el.dataset.requestId);
                    }
                });
            });

            // Inject the small amount of hover styling the cards need.
            if (!document.getElementById('leader-recent-styles')) {
                const style = document.createElement('style');
                style.id = 'leader-recent-styles';
                style.textContent = `
                    .recent-section .recent-card,
                    .recent-section .recent-row {
                        cursor: pointer;
                        transition: background 0.15s ease, border-color 0.15s ease;
                        border-radius: 8px;
                    }
                    .recent-section .recent-card {
                        border: 1px solid #e6eef8;
                        padding: 16px;
                        margin-bottom: 12px;
                        background: #fff;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .recent-section .recent-card:hover,
                    .recent-section .recent-row:hover {
                        background: #FFF6CC;
                    }
                    .recent-section .recent-card:hover {
                        border-color: #c9d5e6;
                    }
                    .recent-section .recent-card:focus-visible,
                    .recent-section .recent-row:focus-visible {
                        outline: 2px solid #2E6FBA;
                        outline-offset: 2px;
                    }
                    .recent-section .recent-card-name {
                        font-size: 16px;
                        font-weight: 700;
                        color: #0B1F3A;
                    }
                    .recent-section .recent-card-society {
                        color: #5A6B87;
                        margin-top: 6px;
                        font-size: 13px;
                    }
                    .recent-section .recent-card-status {
                        display: inline-block;
                        padding: 6px 12px;
                        border-radius: 20px;
                        background: #fff;
                        border: 1px solid #E1E7F0;
                        font-weight: 700;
                        color: #3D4A63;
                        font-size: 12px;
                    }
                    .recent-section .recent-subheading {
                        margin-top: 8px;
                        margin-bottom: 8px;
                        color: #5A6B87;
                        font-size: 13px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .recent-section .recent-row {
                        border-bottom: 1px solid #eee;
                        padding: 10px 12px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .recent-section .recent-row:last-child {
                        border-bottom: none;
                    }
                    .recent-section .recent-row-name {
                        font-weight: 600;
                        color: #0B1F3A;
                        font-size: 14px;
                    }
                    .recent-section .recent-row-society {
                        font-size: 13px;
                        color: #6c757d;
                        margin-top: 2px;
                    }
                    .recent-section .recent-row-status {
                        color: #6c757d;
                        font-size: 13px;
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            recentContainer.innerHTML = '<h2>Recent Requests</h2><p style="color:#6c757d;font-size:14px;">No requests submitted yet.</p>';
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

loadDashboard();