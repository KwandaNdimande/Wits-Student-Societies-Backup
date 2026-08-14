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
// PAGINATION STATE
// ================================================================
let lastDoc = null;
let isLoading = false;
let hasMore = true;
const PAGE_SIZE = 3;
let allLoadedCount = 0;

const container = document.getElementById('announcements-container');
const loadMoreBtn = document.getElementById('load-more-btn');

// ================================================================
// TOAST (kept for errors and other messages)
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
// RENDER ANNOUNCEMENT CARDS (with Edit/Delete)
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
                    <div class="card-actions">
                        <button class="btn-action btn-edit" onclick="openEditAnnouncement('${doc.id}')">Edit</button>
                        <button class="btn-action btn-delete" onclick="deleteAnnouncement('${doc.id}')">Delete</button>
                    </div>
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
        let query = db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .limit(PAGE_SIZE + 1);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

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
        const displayDocs = hasExtra ? allDocs.slice(0, PAGE_SIZE) : allDocs;

        if (displayDocs.length > 0) {
            lastDoc = displayDocs[displayDocs.length - 1];
        }

        renderAnnouncements(displayDocs, loadMore);

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
// UPDATE UNREAD BADGE
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
    } catch (error) {
        console.error('Error updating unread badge:', error);
    }
}

// ================================================================
// POST ANNOUNCEMENT (toast removed after success)
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

        // Clear form
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-category').value = '';
        document.getElementById('announcement-date').value = '';
        document.getElementById('announcement-body').value = '';

        // Toast removed: no success notification after creation

        // Reset pagination and reload
        loadAnnouncements(false);
    } catch (error) {
        console.error(error);
        showToast('❌ Error posting announcement.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = '📤 Post Announcement';
        validateCreateDate();
    }
}

// ================================================================
// OPEN EDIT ANNOUNCEMENT
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
        validateEditDate();
    } catch (error) {
        console.error(error);
        showToast('❌ Error loading announcement.', true);
    }
}

// ================================================================
// SAVE ANNOUNCEMENT EDITS
// ================================================================
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
    btn.textContent = 'Saving...';

    try {
        await db.collection('announcements').doc(currentEditingId).update({
            title, category, date, body,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeAnnouncementModal();
        showToast('✅ Announcement updated!');
        loadAnnouncements(false);
    } catch (error) {
        console.error(error);
        showToast('❌ Error saving.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

// ================================================================
// DELETE ANNOUNCEMENT
// ================================================================
async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
        await db.collection('announcements').doc(id).delete();
        showToast('Deleted.');
        loadAnnouncements(false);
    } catch (error) {
        console.error(error);
        showToast('❌ Error deleting.', true);
    }
}

// ================================================================
// CLOSE MODAL
// ================================================================
function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('active');
    currentEditingId = null;
}
document.getElementById('announcementModal').addEventListener('click', function(e) {
    if (e.target === this) closeAnnouncementModal();
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
    const today = new Date().toISOString().split('T')[0];
    const createDate = document.getElementById('announcement-date');
    const editDate = document.getElementById('edit-ann-date');
    if (createDate) createDate.setAttribute('min', today);
    if (editDate) editDate.setAttribute('min', today);
    if (createDate) {
        createDate.addEventListener('change', validateCreateDate);
        createDate.addEventListener('input', validateCreateDate);
    }
    if (editDate) {
        editDate.addEventListener('change', validateEditDate);
        editDate.addEventListener('input', validateEditDate);
    }
    validateCreateDate();
    validateEditDate();

    loadAnnouncements(false);

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

// Optional: refresh unread badge every 30 seconds
setInterval(updateUnreadBadge, 30000);