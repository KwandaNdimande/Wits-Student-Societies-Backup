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

// Load announcements
async function loadAnnouncements() {
    try {
        const announcementsSnapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();

        const container = document.getElementById('announcements-container');
        
        if (announcementsSnapshot.empty) {
            container.innerHTML = '<p style="color:#6c757d;font-size:14px;">No announcements at this time.</p>';
            return;
        }

        const categoryColors = {
            'Upcoming Event': '#2E6FBA',
            'Training Induction': '#1E8E5A',
            'General Notice': '#6C757D',
            'Deadline Reminder': '#B9720B'
        };

        // compute unread count
        const lastSeen = parseInt(localStorage.getItem('leaderAnnouncementsLastSeen') || '0', 10);
        let unreadCount = 0;

        let html = '';
        announcementsSnapshot.forEach(doc => {
            const a = doc.data();
            const createdMs = a.createdAt ? (a.createdAt.seconds * 1000) : 0;
            if (createdMs > lastSeen) unreadCount++;
            const cat = a.category || 'General Notice';
            const badgeColor = categoryColors[cat] || '#6C757D';
            const relWhen = a.createdAt ? timeAgo(createdMs) : 'N/A';
            html += `
                <div style="border:1px solid #dee2e6;border-radius:8px;padding:20px;background:white;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:6px;">
                        <div>
                            <h2 style="font-weight:600;color:#003B5C;font-size:18px;">${a.title}</h2>
                            <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
                                <span style="display:inline-block;padding:4px 10px;border-radius:12px;background:${badgeColor};color:#fff;font-size:12px;font-weight:700;">${cat}</span>
                            </div>
                        </div>
                        <span style="font-size:12px;color:#6c757d;white-space:nowrap;">${relWhen}</span>
                    </div>
                    <p style="font-size:14px;color:#6c757d;margin-top:4px;">${a.body}</p>
                </div>
            `;
        });

        // update unread badge on nav link
        const navLink = document.querySelector('.nav-links a[href="/leader/announcements.html"]');
        if (navLink) {
            let badge = navLink.querySelector('.ann-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'ann-badge';
                badge.style.cssText = 'background:#E53935;color:#fff;border-radius:999px;padding:2px 8px;font-size:12px;margin-left:8px;';
                navLink.appendChild(badge);
            }
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Load data
loadAnnouncements();

// mark as read when leader views page
document.addEventListener('DOMContentLoaded', function() {
    // set leaderAnnouncementsLastSeen to now after a short delay so badge shows briefly
    setTimeout(() => {
        localStorage.setItem('leaderAnnouncementsLastSeen', Date.now().toString());
        const navLink = document.querySelector('.nav-links a[href="/leader/announcements.html"]');
        if (navLink) {
            const badge = navLink.querySelector('.ann-badge');
            if (badge) badge.style.display = 'none';
        }
    }, 400);
});

function timeAgo(ms) {
    if (!ms) return 'Unknown';
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    return `${mo}mo ago`;
}