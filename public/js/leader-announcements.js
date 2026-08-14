// ---------- SUPABASE INITIALIZATION ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Firebase config
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

// Pagination state
let lastDoc = null;
let isLoading = false;
let hasMore = true;
const PAGE_SIZE = 3;
let allLoadedCount = 0;

const container = document.getElementById('announcements-container');
const loadMoreBtn = document.getElementById('load-more-btn');

// ================================================================
// RENDER ANNOUNCEMENT CARDS
// ================================================================

function renderAnnouncements(docs, append = false) {
    if (!append) {
        container.innerHTML = '';
        allLoadedCount = 0;
    }

    if (docs.length === 0 && allLoadedCount === 0) {
        container.innerHTML = `<div class="no-announcements">📭 No announcements at this time.</div>`;
        loadMoreBtn.classList.add('hidden');
        return;
    }

    let html = '';
    docs.forEach(doc => {
        const a = doc.data();
        const cat = a.category || 'General Notice';
        const badgeColor = categoryColors[cat] || '#6C757D';
        const relWhen = a.createdAt ? timeAgo(a.createdAt.seconds * 1000) : 'N/A';
        const dateStr = a.date || '';

        html += `
            <div class="announcement-card" data-id="${doc.id}">
                <div class="card-header">
                    <div class="title-area">
                        <div class="ann-title">${escapeHtml(a.title)}</div>
                        <div class="ann-meta">
                            <span class="ann-category" style="background:${badgeColor};">${escapeHtml(cat)}</span>
                            <span class="ann-date">${relWhen}</span>
                            ${dateStr ? `<span class="ann-date">${escapeHtml(dateStr)}</span>` : ''}
                        </div>
                    </div>
                    <!-- NO EDIT/DELETE BUTTONS FOR LEADERS -->
                </div>
                <div class="ann-body">${escapeHtml(a.body)}</div>
            </div>
        `;
    });

    if (append) {
        container.insertAdjacentHTML('beforeend', html);
    } else {
        container.innerHTML = html;
    }

    allLoadedCount += docs.length;
}

// ================================================================
// LOAD ANNOUNCEMENTS (with +1 detection)
// ================================================================

async function loadAnnouncements(loadMore = false) {
    if (isLoading) return;
    isLoading = true;

    if (!loadMore) {
        lastDoc = null;
        hasMore = true;
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
    } else {
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
    }

    try {
        // Fetch PAGE_SIZE + 1 to detect if there is a next page
        let query = db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .limit(PAGE_SIZE + 1);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        // If no documents at all
        if (snapshot.empty) {
            hasMore = false;
            loadMoreBtn.classList.add('hidden');
            if (!loadMore && allLoadedCount === 0) {
                container.innerHTML = `<div class="no-announcements">📭 No announcements at this time.</div>`;
            }
            isLoading = false;
            return;
        }

        const allDocs = snapshot.docs;
        const hasExtra = allDocs.length > PAGE_SIZE;

        // The documents to display are the first PAGE_SIZE
        const displayDocs = hasExtra ? allDocs.slice(0, PAGE_SIZE) : allDocs;

        // Update lastDoc to the last displayed document (for next page)
        if (displayDocs.length > 0) {
            lastDoc = displayDocs[displayDocs.length - 1];
        }

        // Render
        renderAnnouncements(displayDocs, loadMore);

        // Determine if there are more
        hasMore = hasExtra;
        if (hasMore) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }

        // Update unread badge only on initial load
        if (!loadMore) {
            updateUnreadBadge();
        }

    } catch (error) {
        console.error('Error loading announcements:', error);
        if (!loadMore) {
            container.innerHTML = `<div class="no-announcements" style="color:#dc3545;">⚠️ Error loading announcements.</div>`;
        } else {
            alert('Failed to load more announcements.');
        }
        loadMoreBtn.classList.add('hidden');
    } finally {
        isLoading = false;
        loadMoreBtn.textContent = 'Load More';
        loadMoreBtn.disabled = false;
        if (!hasMore) {
            loadMoreBtn.classList.add('hidden');
        }
    }
}

// ================================================================
// UPDATE UNREAD BADGE (counts all unread)
// ================================================================

async function updateUnreadBadge() {
    try {
        const lastSeen = parseInt(localStorage.getItem('leaderAnnouncementsLastSeen') || '0', 10);
        const allSnapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();
        let unreadCount = 0;
        allSnapshot.forEach(doc => {
            const a = doc.data();
            const createdMs = a.createdAt ? (a.createdAt.seconds * 1000) : 0;
            if (createdMs > lastSeen) unreadCount++;
        });

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
    } catch (error) {
        console.error('Error updating unread badge:', error);
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
// EVENT LISTENERS
// ================================================================

loadMoreBtn.addEventListener('click', function() {
    if (!isLoading && hasMore) {
        loadAnnouncements(true);
    }
});

// ================================================================
// MARK AS READ & INIT
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    loadAnnouncements(false);

    setTimeout(() => {
        localStorage.setItem('leaderAnnouncementsLastSeen', Date.now().toString());
        const navLink = document.querySelector('.nav-links a[href="/leader/announcements.html"]');
        if (navLink) {
            const badge = navLink.querySelector('.ann-badge');
            if (badge) badge.style.display = 'none';
        }
    }, 500);
});

// Optional: refresh unread badge every 30 seconds
setInterval(updateUnreadBadge, 30000);