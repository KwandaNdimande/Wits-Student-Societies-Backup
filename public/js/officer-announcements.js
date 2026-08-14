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

let currentEditingId = null;

// Category colors
const categoryColors = {
    'Upcoming Event': '#2E6FBA',
    'Training Induction': '#1E8E5A',
    'General Notice': '#6C757D',
    'Deadline Reminder': '#B9720B'
};

// ================================================================
// TOAST
// ================================================================
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const icon = toast.querySelector('.toast-icon');
    toastMessage.textContent = message;
    icon.textContent = isError ? '❌' : '✅';
    toast.style.borderLeftColor = isError ? '#C0392B' : '#1E8E5A';
    toast.classList.add('show');
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
function closeToast() {
    document.getElementById('toast').classList.remove('show');
    clearTimeout(document.getElementById('toast')._hideTimeout);
}

// ================================================================
// DATE VALIDATION
// ================================================================
function isValidDate(dateString) {
    if (!dateString) return false;
    const selected = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected >= today;
}

function validateCreateDate() {
    const dateInput = document.getElementById('announcement-date');
    const errorEl = document.getElementById('date-error');
    const postBtn = document.getElementById('postButton');
    const dateVal = dateInput.value;

    if (dateVal && !isValidDate(dateVal)) {
        errorEl.classList.add('show');
        postBtn.disabled = true;
        return false;
    } else {
        errorEl.classList.remove('show');
        // Re-enable only if all other fields are also filled (optional)
        // We'll just enable if date is valid; other fields validation is done in post
        postBtn.disabled = false;
        return true;
    }
}

function validateEditDate() {
    const dateInput = document.getElementById('edit-ann-date');
    const errorEl = document.getElementById('edit-date-error');
    const saveBtn = document.getElementById('saveAnnBtn');
    const dateVal = dateInput.value;

    if (dateVal && !isValidDate(dateVal)) {
        errorEl.classList.add('show');
        saveBtn.disabled = true;
        return false;
    } else {
        errorEl.classList.remove('show');
        saveBtn.disabled = false;
        return true;
    }
}

// ================================================================
// LOAD ANNOUNCEMENTS
// ================================================================
async function loadAnnouncements() {
    try {
        const snapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();
        const container = document.getElementById('announcements-container');

        if (snapshot.empty) {
            container.innerHTML = `<div class="no-announcements">📭 No announcements at this time.</div>`;
            return;
        }

        const lastSeen = parseInt(localStorage.getItem('leaderAnnouncementsLastSeen') || '0', 10);
        let unreadCount = 0;
        let html = '';

        snapshot.forEach(doc => {
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
                                ${dateStr ? `<span class="ann-date"> ${escapeHtml(dateStr)}</span>` : ''}
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="btn-action btn-edit" onclick="openEditAnnouncement('${doc.id}')">Edit</button>
                            <button class="btn-action btn-delete" onclick="deleteAnnouncement('${doc.id}')">Delete</button>
                        </div>
                    </div>
                    <div class="ann-body">${escapeHtml(a.body)}</div>
                </div>
            `;
        });

        // Update unread badge
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
        showToast('⚠️ Please fill in all required fields.', true);
        return;
    }

    if (!isValidDate(date)) {
        showToast('⚠️ Please select a valid date (today or future).', true);
        return;
    }

    const btn = document.getElementById('postButton');
    btn.disabled = true;
    btn.textContent = 'Posting...';

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not logged in.');
        await db.collection('announcements').add({
            title,
            category,
            date,
            body,
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-category').value = '';
        document.getElementById('announcement-date').value = '';
        document.getElementById('announcement-body').value = '';
        showToast('✅ Announcement posted!');
        loadAnnouncements();
    } catch (error) {
        console.error(error);
        showToast('❌ Error posting announcement.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post Announcement';
        validateCreateDate(); // re-check date state
    }
}

// ================================================================
// EDIT / DELETE
// ================================================================
async function openEditAnnouncement(id) {
    try {
        const doc = await db.collection('announcements').doc(id).get();
        if (!doc.exists) { showToast('⚠️ Not found.', true); return; }
        const data = doc.data();
        currentEditingId = id;

        document.getElementById('edit-ann-title').value = data.title || '';
        document.getElementById('edit-ann-category').value = data.category || '';
        document.getElementById('edit-ann-date').value = data.date || '';
        document.getElementById('edit-ann-body').value = data.body || '';

        document.getElementById('announcementModalTitle').textContent = `Edit: ${data.title || 'Announcement'}`;
        document.getElementById('announcementModal').classList.add('active');
        // Validate initial date
        validateEditDate();
    } catch (error) {
        console.error(error);
        showToast('❌ Error loading announcement.', true);
    }
}

async function saveAnnouncementEdits() {
    if (!currentEditingId) { showToast('⚠️ No announcement selected.', true); return; }
    const title = document.getElementById('edit-ann-title').value.trim();
    const category = document.getElementById('edit-ann-category').value;
    const date = document.getElementById('edit-ann-date').value;
    const body = document.getElementById('edit-ann-body').value.trim();

    if (!title || !category || !body) {
        showToast('⚠️ Please fill in all required fields.', true);
        return;
    }
    if (!isValidDate(date)) {
        showToast('⚠️ Please select a valid date (today or future).', true);
        return;
    }

    const btn = document.getElementById('saveAnnBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    try {
        await db.collection('announcements').doc(currentEditingId).update({
            title, category, date, body,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeAnnouncementModal();
        showToast('✅ Announcement updated!');
        loadAnnouncements();
    } catch (error) {
        console.error(error);
        showToast('❌ Error saving.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
        await db.collection('announcements').doc(id).delete();
        showToast('Deleted.');
        loadAnnouncements();
    } catch (error) {
        console.error(error);
        showToast('❌ Error deleting.', true);
    }
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('active');
    currentEditingId = null;
}

document.getElementById('announcementModal').addEventListener('click', function(e) {
    if (e.target === this) closeAnnouncementModal();
});

// ================================================================
// EVENT LISTENERS FOR DATE VALIDATION
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    const createDate = document.getElementById('announcement-date');
    const editDate = document.getElementById('edit-ann-date');

    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    if (createDate) createDate.setAttribute('min', today);
    if (editDate) editDate.setAttribute('min', today);

    // Listen for changes
    if (createDate) {
        createDate.addEventListener('change', validateCreateDate);
        createDate.addEventListener('input', validateCreateDate);
    }
    if (editDate) {
        editDate.addEventListener('change', validateEditDate);
        editDate.addEventListener('input', validateEditDate);
    }

    // Initial validation
    validateCreateDate();
    validateEditDate();

    // Mark as read
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
// HELPERS
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
// LOAD
// ================================================================
loadAnnouncements();