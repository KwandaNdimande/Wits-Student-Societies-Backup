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

// Load societies
async function loadSocieties() {
    try {
        const societiesSnapshot = await db.collection('societies')
            .orderBy('name', 'asc')
            .get();

        const container = document.getElementById('societies-container');
        
        if (societiesSnapshot.empty) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#6c757d;grid-column:1/-1;">No societies registered yet.</div>';
            return;
        }

        let html = '';
        societiesSnapshot.forEach(doc => {
            const s = doc.data();
            html += `
                <div style="border:1px solid #dee2e6;border-radius:8px;padding:16px 20px;background:white;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <h3 style="font-weight:600;color:#003B5C;font-size:18px;">${s.name}</h3>
                        <button style="font-size:12px;color:#dc3545;background:none;border:none;cursor:pointer;" onclick="deleteSociety('${doc.id}')">Delete</button>
                    </div>
                    <p style="font-size:14px;color:#6c757d;">${s.category || 'General'}</p>
                    <p style="font-size:14px;color:#6c757d;">${s.email || 'No email'}</p>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading societies:', error);
    }
}

// Add new society
async function addSociety() {
    const name = document.getElementById('society-name').value.trim();
    const category = document.getElementById('society-category').value;
    const email = document.getElementById('society-email').value.trim();

    if (!name || !category || !email) {
        alert('Please fill in all fields.');
        return;
    }

    try {
        const btn = document.querySelector('.btn-add');
        btn.disabled = true;
        btn.textContent = 'Adding...';

        await db.collection('societies').add({
            name: name,
            category: category,
            email: email,
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear inputs
        document.getElementById('society-name').value = '';
        document.getElementById('society-category').value = '';
        document.getElementById('society-email').value = '';

        // Reload societies
        loadSocieties();

    } catch (error) {
        console.error('Error adding society:', error);
        alert('Error adding society: ' + error.message);
    } finally {
        const btn = document.querySelector('.btn-add');
        btn.disabled = false;
        btn.textContent = 'Add Society';
    }
}

// Delete society
async function deleteSociety(societyId) {
    if (!confirm('Are you sure you want to delete this society? This cannot be undone.')) return;

    try {
        await db.collection('societies').doc(societyId).delete();
        loadSocieties();
    } catch (error) {
        console.error('Error deleting society:', error);
        alert('Error deleting society: ' + error.message);
    }
}

// Load data
loadSocieties();