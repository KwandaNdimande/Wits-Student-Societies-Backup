// ---------- SUPABASE INITIALIZATION (for consistency) ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';

// Create a global supabase client
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

let currentEditingId = null;

// Category colors
const categoryColors = {
    'Upcoming Event': '#2E6FBA',
    'Training Induction': '#1E8E5A',
    'General Notice': '#6C757D',
    'Deadline Reminder': '#B9720B'
};

// ================================================================
// TOAST NOTIFICATION
// ================================================================

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function closeToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('show');
    clearTimeout(toast._hideTimeout);
}

// ================================================================
// LOAD ANNOUNCEMENTS
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

        // Compute unread count
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
                        <div class="card-actions">
                            <button class="btn-action btn-edit" onclick="openEditAnnouncement('${doc.id}')">✏️ Edit</button>
                            <button class="btn-action btn-delete" onclick="deleteAnnouncement('${doc.id}')">🗑️ Delete</button>
                        </div>
                    </div>
                    <div class="ann-body">${escapeHtml(a.body)}</div>
                </div>
            `;
        });

        // Update unread badge on nav link
        const navLink = document.querySelector('.nav-links a[href="/officer/announcements.html"]') ||
                        document.querySelector('.nav-links a[href="/leader/announcements.html"]');
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
// POST ANNOUNCEMENT
// ================================================================

async function postAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const category = document.getElementById('announcement-category').value;
    const date = document.getElementById('announcement-date').value;
    const body = document.getElementById('announcement-body').value.trim();

    if (!title || !category || !body) {
        showToast('⚠️ Please fill in all required fields.');
        return;
    }

    const btn = document.querySelector('.btn-post');
    btn.disabled = true;
    btn.textContent = '⏳ Posting...';

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User not logged in.');

        await db.collection('announcements').add({
            title,
            category,
            date,
            body,
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear form
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-category').value = '';
        document.getElementById('announcement-date').value = '';
        document.getElementById('announcement-body').value = '';

        showToast('✅ Announcement posted successfully!');
        loadAnnouncements();

    } catch (error) {
        console.error('Error posting announcement:', error);
        showToast('❌ Error posting announcement. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = '📤 Post Announcement';
    }
}

// ================================================================
// OPEN EDIT ANNOUNCEMENT
// ================================================================

async function openEditAnnouncement(id) {
    try {
        const doc = await db.collection('announcements').doc(id).get();
        if (!doc.exists) {
            showToast('⚠️ Announcement not found.');
            return;
        }

        const data = doc.data();
        currentEditingId = id;

        document.getElementById('edit-ann-title').value = data.title || '';
        document.getElementById('edit-ann-category').value = data.category || '';
        document.getElementById('edit-ann-date').value = data.date || '';
        document.getElementById('edit-ann-body').value = data.body || '';

        document.getElementById('announcementModalTitle').textContent = `✏️ Edit: ${data.title || 'Announcement'}`;
        document.getElementById('announcementModal').classList.add('active');

    } catch (error) {
        console.error('Error loading announcement:', error);
        showToast('❌ Error loading announcement.');
    }
}

// ================================================================
// SAVE ANNOUNCEMENT EDITS
// ================================================================

async function saveAnnouncementEdits() {
    if (!currentEditingId) {
        showToast('⚠️ No announcement selected.');
        return;
    }

    const title = document.getElementById('edit-ann-title').value.trim();
    const category = document.getElementById('edit-ann-category').value;
    const date = document.getElementById('edit-ann-date').value;
    const body = document.getElementById('edit-ann-body').value.trim();

    if (!title || !category || !body) {
        showToast('⚠️ Please fill in all required fields.');
        return;
    }

    const btn = document.getElementById('saveAnnBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    try {
        await db.collection('announcements').doc(currentEditingId).update({
            title,
            category,
            date,
            body,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeAnnouncementModal();
        showToast('✅ Announcement updated successfully!');
        loadAnnouncements();

    } catch (error) {
        console.error('Error saving announcement:', error);
        showToast('❌ Error saving announcement.');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Save Changes';
    }
}

// ================================================================
// DELETE ANNOUNCEMENT
// ================================================================

async function deleteAnnouncement(id) {
    if (!confirm('Are you sure you want to delete this announcement? This cannot be undone.')) return;

    try {
        await db.collection('announcements').doc(id).delete();
        showToast('🗑️ Announcement deleted successfully!');
        loadAnnouncements();

    } catch (error) {
        console.error('Error deleting announcement:', error);
        showToast('❌ Error deleting announcement.');
    }
}

// ================================================================
// CLOSE MODAL
// ================================================================

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('active');
    currentEditingId = null;
}

// Close modal on overlay click
document.getElementById('announcementModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeAnnouncementModal();
    }
});

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
        const navLink = document.querySelector('.nav-links a[href="/officer/announcements.html"]') ||
                        document.querySelector('.nav-links a[href="/leader/announcements.html"]');
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