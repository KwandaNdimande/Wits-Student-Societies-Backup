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

// Load documents
async function loadDocuments() {
    try {
        const docsSnapshot = await db.collection('documents')
            .orderBy('name', 'asc')
            .get();

        const container = document.getElementById('documents-container');
        
        if (docsSnapshot.empty) {
            container.innerHTML = '<p style="color:#6c757d;font-size:14px;">No documents available.</p>';
            return;
        }

        let html = '';
        docsSnapshot.forEach(doc => {
            const d = doc.data();
            html += `
                <div style="border:1px solid #dee2e6;border-radius:8px;padding:16px 20px;background:white;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="flex:1;">
                        <p style="font-weight:500;color:#003B5C;font-size:16px;">${d.name}</p>
                        <p style="font-size:14px;color:#6c757d;margin-top:2px;">${d.description || ''}</p>
                    </div>
                    <button style="padding:6px 16px;border:1px solid #003B5C;border-radius:6px;background:transparent;color:#003B5C;font-size:14px;cursor:pointer;font-family:'Times New Roman',serif;" onclick="downloadDocument('${doc.id}')">Download</button>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

// Download document (placeholder - actual download would use Firebase Storage)
function downloadDocument(docId) {
    alert('Download functionality coming soon. Document ID: ' + docId);
}

// Load data
loadDocuments();