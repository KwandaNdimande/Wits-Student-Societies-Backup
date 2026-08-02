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

        let html = '';
        announcementsSnapshot.forEach(doc => {
            const a = doc.data();
            html += `
                <div style="border:1px solid #dee2e6;border-radius:8px;padding:20px;background:white;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:4px;">
                        <h2 style="font-weight:600;color:#003B5C;font-size:18px;">${a.title}</h2>
                        <span style="font-size:12px;color:#6c757d;white-space:nowrap;">${a.createdAt ? new Date(a.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
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

// Load data
loadAnnouncements();