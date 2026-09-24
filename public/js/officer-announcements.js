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

// Category colors (no emoji)
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
// DATE VALIDATION
// ================================================================
function isValidDate(dateString) {
    if (!dateString) return false;
    const selected = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected >= today;
}

// ================================================================
// ASTERISK HELPERS
// ================================================================
function isTitleOnlyNumbers(value) {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 && /^[0-9]+$/.test(trimmed);
}

function isTitleTooShort(value) {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 && trimmed.length < 3;
}

function isBodyOnlyNumbers(value) {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 && /^[0-9]+$/.test(trimmed);
}

function isBodyTooShort(value) {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 && trimmed.length < 10;
}

function validateTitle() {
    const input = document.getElementById('announcement-title');
    if (!input) return true;
    const value = input.value.trim();

    if (!value) {
        showFieldError('announcement-title', 'title-error', 'Error: Title is required.');
        return false;
    }
    if (isTitleOnlyNumbers(value)) {
        showFieldError('announcement-title', 'title-error', 'Error: Title cannot be numbers only.');
        return false;
    }
    if (isTitleTooShort(value)) {
        showFieldError('announcement-title', 'title-error', 'Error: Title must be at least 3 characters.');
        return false;
    }

    hideFieldError('announcement-title', 'title-error');
    return true;
}

function validateBody() {
    const textarea = document.getElementById('announcement-body');
    if (!textarea) return true;
    const value = textarea.value.trim();

    if (!value) {
        showFieldError('announcement-body', 'body-error', 'Error: Message is required.');
        return false;
    }
    if (isBodyOnlyNumbers(value)) {
        showFieldError('announcement-body', 'body-error', 'Error: Message cannot be numbers only.');
        return false;
    }
    if (isBodyTooShort(value)) {
        showFieldError('announcement-body', 'body-error', 'Error: Message must be at least 10 characters.');
        return false;
    }

    hideFieldError('announcement-body', 'body-error');
    return true;
}

function setAsterisk(id, visible) {
    const el = document.getElementById(id);
    if (!el) return;
    if (visible) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

// ================================================================
// FIELD ERROR HELPERS
// ================================================================
function showFieldError(inputId, errorId, message) {
    const inputEl = document.getElementById(inputId);
    if (inputEl) inputEl.classList.add('input-error');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function categoryNeedsDate(category) {
    return category === 'Upcoming Event' || category === 'Training Induction';
}

function updateDateFieldVisibility() {
    const category = document.getElementById('announcement-category')?.value || '';
    const group = document.getElementById('date-field-group');
    const dateInput = document.getElementById('announcement-date');
    if (!group) return;

    if (categoryNeedsDate(category)) {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
        if (dateInput) dateInput.value = '';
        hideFieldError('announcement-date', 'date-error');
    }
}

function hideFieldError(inputId, errorId) {
    const inputEl = document.getElementById(inputId);
    if (inputEl) inputEl.classList.remove('input-error');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.classList.remove('show');
        errorEl.textContent = '';
    }
}

function hideAllErrors() {
    hideFieldError('announcement-title', 'title-error');
    hideFieldError('announcement-category', 'category-error');
    hideFieldError('announcement-date', 'date-error');
    hideFieldError('announcement-body', 'body-error');
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.style.borderLeftColor = isError ? '#C0392B' : '#1E8E5A';

    toast.classList.add('show');
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function closeToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.classList.remove('show');
    clearTimeout(toast._hideTimeout);
}

// ================================================================
// FORM VALIDITY
// ================================================================
function isCreateFormValid() {
    const title = document.getElementById('announcement-title')?.value.trim() || '';
    const category = document.getElementById('announcement-category')?.value || '';
    const date = document.getElementById('announcement-date')?.value || '';
    const body = document.getElementById('announcement-body')?.value.trim() || '';

    if (!title || !category || !body) return false;
    if (isTitleOnlyNumbers(title) || isTitleTooShort(title)) return false;
    if (isBodyOnlyNumbers(body) || isBodyTooShort(body)) return false;

    if (categoryNeedsDate(category)) {
        if (!date) return false;
        if (!isValidDate(date)) return false;
    }

    return true;
}

function updateCreateButtonState() {
    const btn = document.getElementById('postButton');
    if (!btn) return;
    btn.disabled = !isCreateFormValid();
}

// ================================================================
// UPDATE ASTERISK STATE ON INPUT CHANGE
// ================================================================
function updateAsterisks() {
    const title = document.getElementById('announcement-title')?.value.trim() || '';
    const category = document.getElementById('announcement-category')?.value || '';
    const date = document.getElementById('announcement-date')?.value || '';
    const body = document.getElementById('announcement-body')?.value.trim() || '';

    setAsterisk('req-title', !title);
    setAsterisk('req-category', !category);
    setAsterisk('req-date', categoryNeedsDate(category) && !date);
    setAsterisk('req-body', !body);
}

// ================================================================
// DATE VALIDATION (with inline error)
// ================================================================
function validateCreateDate() {
    const category = document.getElementById('announcement-category')?.value || '';
    const dateInput = document.getElementById('announcement-date');
    const dateVal = dateInput?.value || '';

    if (!categoryNeedsDate(category)) {
        hideFieldError('announcement-date', 'date-error');
        return true;
    }

    if (!dateVal) {
        // No message — the asterisk already signals it's required
        hideFieldError('announcement-date', 'date-error');
        return false;
    }

    if (!isValidDate(dateVal)) {
        showFieldError('announcement-date', 'date-error', 'Error: Please select a date from today onwards.');
        return false;
    }

    hideFieldError('announcement-date', 'date-error');
    return true;
}

// ================================================================
// RENDER ANNOUNCEMENTS (TABLE)
// ================================================================
function renderAnnouncements(docs, append = false) {
    if (!append) {
        container.innerHTML = '';
        allLoadedCount = 0;
    }

    if (docs.length === 0 && allLoadedCount === 0) {
        container.innerHTML = `<div class="no-announcements">No announcements at this time.</div>`;
        loadMoreBtn.classList.add('hidden');
        return;
    }

    let html = '';
    if (!append) {
        html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Posted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
    }

    docs.forEach((doc, index) => {
        const rowNum = allLoadedCount + index + 1;
        const a = doc.data();
        const cat = a.category || 'General Notice';
        const badgeColor = categoryColors[cat] || '#6C757D';
        const relWhen = a.createdAt ? timeAgo(a.createdAt.seconds * 1000) : 'N/A';
        const docId = doc.id;

        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${rowNum}</td>
                <td>${escapeHtml(a.title)}</td>
                <td><span class="category-badge" style="background:${badgeColor};">${escapeHtml(cat)}</span></td>
                <td style="color:#6c757d;">${relWhen}</td>
                <td>
                    <button class="btn-action btn-view" onclick="viewAnnouncement('${docId}')">View</button>
                    <button class="btn-action btn-delete" onclick="deleteAnnouncement('${docId}')">Delete</button>
                </td>
            </tr>
        `;
    });

    if (!append) {
        html += `
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    } else {
        const tbody = container.querySelector('tbody');
        if (tbody) {
            const rowsHtml = docs.map((doc, index) => {
                const rowNum = allLoadedCount + index + 1;
                const a = doc.data();
                const cat = a.category || 'General Notice';
                const badgeColor = categoryColors[cat] || '#6C757D';
                const relWhen = a.createdAt ? timeAgo(a.createdAt.seconds * 1000) : 'N/A';
                const docId = doc.id;
                return `
                    <tr>
                        <td style="color:#6c757d;font-weight:500;">${rowNum}</td>
                        <td>${escapeHtml(a.title)}</td>
                        <td><span class="category-badge" style="background:${badgeColor};">${escapeHtml(cat)}</span></td>
                        <td style="color:#6c757d;">${relWhen}</td>
                        <td>
                            <button class="btn-action btn-view" onclick="viewAnnouncement('${docId}')">View</button>
                            <button class="btn-action btn-delete" onclick="deleteAnnouncement('${docId}')">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
            tbody.insertAdjacentHTML('beforeend', rowsHtml);
        }
    }

    allLoadedCount += docs.length;
}

// ================================================================
// LOAD ANNOUNCEMENTS
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
                container.innerHTML = `<div class="no-announcements">No announcements at this time.</div>`;
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

    } catch (error) {
        console.error('Error loading announcements:', error);
        if (!loadMore) {
            container.innerHTML = `<div class="loading-text" style="color:#dc3545;">Error loading announcements.</div>`;
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
// VIEW ANNOUNCEMENT (modal)
// ================================================================
async function viewAnnouncement(id) {
    try {
        const doc = await db.collection('announcements').doc(id).get();
        if (!doc.exists) {
            alert('Announcement not found.');
            return;
        }
        const data = doc.data();
        document.getElementById('view-title').textContent = data.title || '-';
        document.getElementById('view-category').textContent = data.category || 'General Notice';

        const eventDateRow = document.getElementById('view-event-date-row');
        if (data.date) {
            const eventDateStr = new Date(data.date + 'T00:00:00').toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
            document.getElementById('view-event-date').textContent = eventDateStr;
            if (eventDateRow) eventDateRow.classList.remove('hidden');
        } else {
            if (eventDateRow) eventDateRow.classList.add('hidden');
        }

        const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
        document.getElementById('view-date').textContent = dateStr;
        document.getElementById('view-message').textContent = data.body || 'No message.';
        document.getElementById('viewModalTitle').textContent = 'Announcement';
        document.getElementById('viewModal').classList.add('active');
    } catch (error) {
        console.error('Error loading announcement:', error);
        alert('Could not load announcement.');
    }
}

function closeViewModal() {
    document.getElementById('viewModal').classList.remove('active');
}
document.getElementById('viewModal').addEventListener('click', function(e) {
    if (e.target === this) closeViewModal();
});

// ================================================================
// POST ANNOUNCEMENT
// ================================================================
async function postAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const category = document.getElementById('announcement-category').value;
    const date = document.getElementById('announcement-date').value;
    const body = document.getElementById('announcement-body').value.trim();

    const titleValid = validateTitle();
    const bodyValid = validateBody();
    const dateValid = validateCreateDate();

    // Category: red border only — asterisk already signals it's required
    const categoryEl = document.getElementById('announcement-category');
    if (!category) {
        if (categoryEl) categoryEl.classList.add('input-error');
    } else {
        if (categoryEl) categoryEl.classList.remove('input-error');
    }

    if (!titleValid || !bodyValid || !dateValid || !category) {
        return;
    }

    const btn = document.getElementById('postButton');
    btn.disabled = true;
    btn.classList.add('no-tooltip');
    btn.textContent = 'Posting...';

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not logged in.');
        await db.collection('announcements').add({
            title,
            category,
            date: categoryNeedsDate(category) ? date : null,
            body,
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear form
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-category').value = '';
        document.getElementById('announcement-date').value = '';
        document.getElementById('announcement-body').value = '';

        // Reset asterisks + hide errors
        hideAllErrors();
        updateAsterisks();
        updateDateFieldVisibility();

        showToast('Announcement posted successfully!');
        loadAnnouncements(false);
    } catch (error) {
        console.error(error);
        showToast('Error posting announcement.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post Announcement';
        updateCreateButtonState();
    }
}

// ================================================================
// DELETE
// ================================================================
async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
        await db.collection('announcements').doc(id).delete();
        loadAnnouncements(false);
    } catch (error) {
        console.error(error);
        alert('Error deleting announcement.');
    }
}

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

// Re-enable the tooltip once the cursor leaves the button area
const btnWrapper = document.querySelector('.btn-wrapper');
if (btnWrapper) {
    btnWrapper.addEventListener('mouseleave', function() {
        const postBtn = document.getElementById('postButton');
        if (postBtn) postBtn.classList.remove('no-tooltip');
    });
}

// Form field listeners — update asterisks + button state, clear errors on fix
['announcement-title', 'announcement-category', 'announcement-date', 'announcement-body'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = () => {
         if (id === 'announcement-category') {
            updateDateFieldVisibility();
        }
        updateAsterisks();
        updateCreateButtonState();

        if (id === 'announcement-title') {
            validateTitle();
        } else if (id === 'announcement-body') {
            validateBody();
        } else if (id === 'announcement-date') {
            validateCreateDate();
        } else if (id === 'announcement-category') {
            if (el.value) el.classList.remove('input-error');
        }
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
});

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    const createDate = document.getElementById('announcement-date');
    if (createDate) createDate.setAttribute('min', today);

    updateDateFieldVisibility();
    updateAsterisks();
    updateCreateButtonState();

    loadAnnouncements(false);
});