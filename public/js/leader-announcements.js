// ---------- SUPABASE INITIALIZATION (for consistency) ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

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

// Category colors
const categoryColors = {
    'Upcoming Event': '#2E6FBA',
    'Training Induction': '#1E8E5A',
    'General Notice': '#6C757D',
    'Deadline Reminder': '#B9720B'
};

// ================================================================
// LOAD ANNOUNCEMENTS (READ-ONLY)
// ================================================================

async function loadAnnouncements() {
    try {
        const announcementsSnapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();

        const container = document.getElementById('announcements-container');

        if (announcementsSnapshot.empty) {
            container.innerHTML = `<div class="no-announcements">📭 No announcements at this time.</div>`;
            return;
        }

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
            const dateStr = a.date || '';

            html += `
                <div class="announcement-card" data-id="${doc.id}">
                    <div class="card-header">
                        <div class="title-area">
                            <div class="ann-title">${escapeHtml(a.title)}</div>
                            <div class="ann-meta">
                                <span class="ann-category" style="background:${badgeColor};">${escapeHtml(cat)}</span>
                                <span class="ann-date">${relWhen}</span>
                                ${dateStr ? `<span class="ann-date">📅 ${escapeHtml(dateStr)}</span>` : ''}
                            </div>
                        </div>
                        <!-- NO EDIT/DELETE BUTTONS FOR LEADERS -->
                    </div>
                    <div class="ann-body">${escapeHtml(a.body)}</div>
                </div>
            `;
        });

        // Update unread badge on nav link
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
        document.getElementById('announcements-container').innerHTML =
            `<div class="no-announcements" style="color:#dc3545;">⚠️ Error loading announcements.</div>`;
    }
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// ================================================================
// MARK AS READ
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        localStorage.setItem('leaderAnnouncementsLastSeen', Date.now().toString());
        const navLink = document.querySelector('.nav-links a[href="/leader/announcements.html"]');
        if (navLink) {
            const badge = navLink.querySelector('.ann-badge');
            if (badge) badge.style.display = 'none';
        }
    }, 500);
});

// ================================================================
// LOAD DATA
// ================================================================

loadAnnouncements();