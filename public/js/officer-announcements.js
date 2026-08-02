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

        let html = '';
        announcementsSnapshot.forEach(doc => {
            const a = doc.data();
            html += `
                <div style="border:1px solid #dee2e6;border-radius:8px;padding:20px;background:white;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:4px;">
                        <h2 style="font-weight:600;color:#003B5C;font-size:18px;">${a.title}</h2>
                        <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                            <span style="font-size:12px;color:#6c757d;">${a.createdAt ? new Date(a.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
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

    if (!title || !body) {
        alert('Please fill in both title and message.');
        return;
    }

    try {
        const btn = document.querySelector('.btn-post');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        await db.collection('announcements').add({
            title: title,
            body: body,
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear inputs
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-body').value = '';

        // Reload announcements
        loadAnnouncements();

    } catch (error) {
        console.error('Error posting announcement:', error);
        alert('Error posting announcement: ' + error.message);
    } finally {
        const btn = document.querySelector('.btn-post');
        btn.disabled = false;
        btn.textContent = 'Post Announcement';
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
        alert('Error deleting announcement: ' + error.message);
    }
}

// Load data
loadAnnouncements();