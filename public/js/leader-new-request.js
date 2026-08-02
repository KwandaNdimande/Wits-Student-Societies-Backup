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

// Get current user
let currentUser = null;
let userRole = localStorage.getItem('userRole');
let userUid = localStorage.getItem('userUid');

// Redirect if not logged in
if (!userUid) {
    window.location.href = '/login.html';
}

// Load user data
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('society-name').value = userData.societyName || 'Your Society';
        }
    } else {
        window.location.href = '/login.html';
    }
});

// Submit request
document.getElementById('submit-request').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const type = document.getElementById('request-type').value;
    const itemName = document.getElementById('item-name').value;
    const amount = document.getElementById('amount').value;
    const description = document.getElementById('description').value;
    const budgetForm = document.getElementById('budget-form').files[0];
    const meetingMinutes = document.getElementById('meeting-minutes').files[0];
    const vendorQuotation = document.getElementById('vendor-quotation').files[0];
    
    // Validation
    if (!type || !itemName || !amount || !description) {
        alert('Please fill in all fields.');
        return;
    }
    
    if (!budgetForm || !meetingMinutes || !vendorQuotation) {
        alert('Please upload all required documents.');
        return;
    }
    
    try {
        // Show loading state
        const btn = document.getElementById('submit-request');
        btn.disabled = true;
        btn.textContent = 'Submitting...';
        
        // Create request object
        const requestData = {
            type: type,
            itemName: itemName,
            amount: parseFloat(amount),
            description: description,
            status: 'Submitted',
            submittedBy: userUid,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            societyName: document.getElementById('society-name').value || 'Your Society',
            documents: {
                budgetForm: budgetForm.name,
                meetingMinutes: meetingMinutes.name,
                vendorQuotation: vendorQuotation.name
            }
        };
        
        // Save to Firestore
        const docRef = await db.collection('requests').add(requestData);
        
        // Show success
        document.getElementById('form-section').classList.add('hidden');
        document.getElementById('success-section').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error submitting request:', error);
        alert('Error submitting request: ' + error.message);
    } finally {
        const btn = document.getElementById('submit-request');
        btn.disabled = false;
        btn.textContent = 'Submit Request';
    }
});

// Reset form
function resetForm() {
    document.getElementById('request-type').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
    
    document.getElementById('form-section').classList.remove('hidden');
    document.getElementById('success-section').classList.add('hidden');
}