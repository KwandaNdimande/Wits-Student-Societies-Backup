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
const userRole = localStorage.getItem('userRole');
if (!userUid || userRole !== 'officer') {
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

        let html = '';
        announcementsSnapshot.forEach(doc => {
            const a = doc.data();
            const cat = a.category || 'General Notice';
            const badgeColor = categoryColors[cat] || '#6C757D';
            const relevantDate = a.relevantDate ? new Date(a.relevantDate.seconds * 1000).toLocaleDateString() : '';
            html += `
                <div style="border:1px solid #dee2e6;border-radius:8px;padding:20px;background:white;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:8px;">
                        <div>
                            <h2 style="font-weight:600;color:#003B5C;font-size:18px;">${a.title}</h2>
                            <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
                                <span style="display:inline-block;padding:4px 10px;border-radius:12px;background:${badgeColor};color:#fff;font-size:12px;font-weight:700;">${cat}</span>
                                ${relevantDate ? `<span style="font-size:12px;color:#6c757d;">Relevant: ${relevantDate}</span>` : ''}
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                            <span style="font-size:12px;color:#6c757d;">${a.createdAt ? new Date(a.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                            <button style="font-size:12px;color:#0069D9;background:none;border:none;cursor:pointer;" onclick="openEditAnnouncement('${doc.id}')">Edit</button>
                            <button style="font-size:12px;color:#dc3545;background:none;border:none;cursor:pointer;" onclick="deleteAnnouncement('${doc.id}')">Delete</button>
                        </div>
                    </div>
                    <p style="font-size:14px;color:#6c757d;margin-top:4px;">${a.body}</p>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Post new announcement
async function postAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const body = document.getElementById('announcement-body').value.trim();
    const category = document.getElementById('announcement-category')?.value || 'General Notice';
    const relevantDateVal = document.getElementById('announcement-date')?.value || '';
    const relevantDate = relevantDateVal ? new Date(relevantDateVal) : null;

    if (!title || !body) {
        alert('Please enter both a title and a message.');
        return;
    }

    try {
        const btn = document.querySelector('.btn-post');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        const payload = {
            title: title,
            body: body,
            category: category,
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (relevantDate) payload.relevantDate = firebase.firestore.Timestamp.fromDate(relevantDate);
        await db.collection('announcements').add(payload);

        // Clear inputs
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-body').value = '';

        // Reload announcements
        loadAnnouncements();

    } catch (error) {
        console.error('Error posting announcement:', error);
        alert('Error posting announcement. ' + error.message);
    } finally {
        const btn = document.querySelector('.btn-post');
        btn.disabled = false;
        btn.textContent = 'Post Announcement';
    }
}

// Edit modal helpers
function closeAnnouncementModal() {
    const modal = document.getElementById('announcementModal');
    modal.style.display = 'none';
    delete modal.dataset.editingId;
}

async function openEditAnnouncement(announcementId) {
    try {
        const doc = await db.collection('announcements').doc(announcementId).get();
        if (!doc.exists) { alert('Announcement not found.'); return; }
        const a = doc.data();
        document.getElementById('edit-ann-title').value = a.title || '';
        document.getElementById('edit-ann-body').value = a.body || '';
        document.getElementById('edit-ann-category').value = a.category || '';
        if (a.relevantDate) {
            const d = new Date(a.relevantDate.seconds * 1000);
            document.getElementById('edit-ann-date').value = d.toISOString().slice(0,10);
        } else {
            document.getElementById('edit-ann-date').value = '';
        }
        const modal = document.getElementById('announcementModal');
        modal.dataset.editingId = announcementId;
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error opening announcement for edit:', error);
        alert('Error opening announcement. ' + error.message);
    }
}

async function saveAnnouncementEdits() {
    const modal = document.getElementById('announcementModal');
    const id = modal.dataset.editingId;
    if (!id) return;
    const title = document.getElementById('edit-ann-title').value.trim();
    const body = document.getElementById('edit-ann-body').value.trim();
    const category = document.getElementById('edit-ann-category').value || 'General Notice';
    const relevantDateVal = document.getElementById('edit-ann-date').value || '';
    const updateData = { title, body, category, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (relevantDateVal) {
        updateData.relevantDate = firebase.firestore.Timestamp.fromDate(new Date(relevantDateVal));
    } else {
        updateData.relevantDate = null;
    }

    try {
        await db.collection('announcements').doc(id).update(updateData);
        closeAnnouncementModal();
        loadAnnouncements();
    } catch (error) {
        console.error('Error saving announcement edits:', error);
        alert('Error saving announcement. ' + error.message);
    }
}

// Delete announcement
async function deleteAnnouncement(announcementId) {
    if (!confirm('Delete this announcement?')) return;

    try {
        await db.collection('announcements').doc(announcementId).delete();
        loadAnnouncements();
    } catch (error) {
        console.error('Error deleting announcement:', error);
        alert('Error deleting announcement. ' + error.message);
    }
}

// Load data
loadAnnouncements();