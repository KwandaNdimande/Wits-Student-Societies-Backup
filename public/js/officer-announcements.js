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

// ================================================================
// RENDER ANNOUNCEMENTS (TABLE - no Edit button)
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
            container.innerHTML = `<div class="no-announcements" style="color:#dc3545;">Error loading announcements.</div>`;
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

    if (!title || !category || !body) {
        alert('Please fill in all required fields.');
        return;
    }
    if (!isValidDate(date)) {
        alert('Please select a valid date (today or future).');
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

        loadAnnouncements(false);
    } catch (error) {
        console.error(error);
        alert('Error posting announcement.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post Announcement';
        validateCreateDate();
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

function cancelAnnouncement() {
    document.getElementById('announcement-title').value = '';
    document.getElementById('announcement-category').value = '';
    document.getElementById('announcement-date').value = '';
    document.getElementById('announcement-body').value = '';
    validateCreateDate();
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

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    const createDate = document.getElementById('announcement-date');
    if (createDate) createDate.setAttribute('min', today);
    if (createDate) {
        createDate.addEventListener('change', validateCreateDate);
        createDate.addEventListener('input', validateCreateDate);
    }
    validateCreateDate();

    loadAnnouncements(false);
});