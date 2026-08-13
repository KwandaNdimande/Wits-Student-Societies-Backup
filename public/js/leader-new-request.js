// ---------- SUPABASE INITIALIZATION ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';

// Create a global supabase client that all functions can use
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

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
function setFieldError(fieldGroupId, message) {
    const group = document.getElementById(fieldGroupId);
    if (!group) return;
    const error = group.querySelector('.form-error');
    if (message) {
        group.classList.add('field-invalid');
        if (error) error.textContent = message;
    } else {
        group.classList.remove('field-invalid');
        if (error) error.textContent = '';
    }
}

function clearAllErrors() {
    ['request-type', 'item-name', 'amount', 'description', 'budget-form', 'meeting-minutes', 'vendor-quotation'].forEach((id) => {
        const group = document.getElementById('group-' + id);
        if (group) group.classList.remove('field-invalid');
        const error = group ? group.querySelector('.form-error') : null;
        if (error) error.textContent = '';
    });
    const summary = document.getElementById('form-error');
    if (summary) summary.textContent = '';
}

function isValidPdf(file) {
    return file && /\.pdf$/i.test(file.name);
}

function isValidExcel(file) {
    return file && /\.(xlsx|xls)$/i.test(file.name);
}

function getFileErrorText(inputId) {
    if (inputId === 'budget-form') return 'Budget Form is required.';
    if (inputId === 'meeting-minutes') return 'Meeting Minutes are required.';
    if (inputId === 'vendor-quotation') return 'Vendor Quotation is required.';
    return 'File is required.';
}

function validateField() {
    clearAllErrors();
    let valid = true;

    const type = document.getElementById('request-type').value.trim();
    if (!type) {
        setFieldError('group-request-type', 'Request type is required.');
        valid = false;
    }

    const itemName = document.getElementById('item-name').value.trim();
    if (!itemName) {
        setFieldError('group-item-name', 'Event or item name is required.');
        valid = false;
    }

    const amountValue = document.getElementById('amount').value.trim();
    const amount = parseFloat(amountValue);
    if (!amountValue) {
        setFieldError('group-amount', 'Amount requested is required.');
        valid = false;
    } else if (isNaN(amount) || amount <= 0) {
        setFieldError('group-amount', 'Enter a valid amount greater than zero.');
        valid = false;
    }

    const description = document.getElementById('description').value.trim();
    if (!description) {
        setFieldError('group-description', 'Description is required.');
        valid = false;
    }

    const budgetForm = document.getElementById('budget-form').files[0];
    if (!budgetForm) {
        setFieldError('group-budget-form', getFileErrorText('budget-form'));
        valid = false;
    } else if (!isValidExcel(budgetForm)) {
        setFieldError('group-budget-form', 'Budget Form must be an Excel file (.xlsx or .xls).');
        valid = false;
    }

    const meetingMinutes = document.getElementById('meeting-minutes').files[0];
    if (!meetingMinutes) {
        setFieldError('group-meeting-minutes', getFileErrorText('meeting-minutes'));
        valid = false;
    } else if (!isValidPdf(meetingMinutes)) {
        setFieldError('group-meeting-minutes', 'Meeting Minutes must be a PDF file.');
        valid = false;
    }

    const vendorQuotation = document.getElementById('vendor-quotation').files[0];
    if (!vendorQuotation) {
        setFieldError('group-vendor-quotation', getFileErrorText('vendor-quotation'));
        valid = false;
    } else if (!isValidPdf(vendorQuotation)) {
        setFieldError('group-vendor-quotation', 'Vendor Quotation must be a PDF file.');
        valid = false;
    }

    document.getElementById('submit-request').disabled = !valid;
    return valid;
}

function handleFileInput(event) {
    const input = event.target;
    const file = input.files[0];
    const groupId = 'group-' + input.id;

    if (!file) {
        setFieldError(groupId, getFileErrorText(input.id));
    } else if (input.id === 'budget-form' && !isValidExcel(file)) {
        setFieldError(groupId, 'File must be an Excel document (.xlsx or .xls).');
    } else if (input.id !== 'budget-form' && !isValidPdf(file)) {
        setFieldError(groupId, 'File must be a PDF file.');
    } else {
        setFieldError(groupId, '');
    }

    validateField();
}

function resetForm() {
    document.getElementById('request-type').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
    clearAllErrors();
    document.getElementById('form-section').classList.remove('hidden');
    document.getElementById('success-section').classList.add('hidden');
    document.getElementById('submit-request').disabled = true;
}

function confirmCancel() {
    if (confirm('Are you sure you want to discard this request?')) {
        resetForm();
    }
}

document.getElementById('request-type').addEventListener('change', validateField);
document.getElementById('item-name').addEventListener('input', validateField);
document.getElementById('amount').addEventListener('input', validateField);
document.getElementById('description').addEventListener('input', validateField);
document.getElementById('budget-form').addEventListener('change', handleFileInput);
document.getElementById('meeting-minutes').addEventListener('change', handleFileInput);
document.getElementById('vendor-quotation').addEventListener('change', handleFileInput);
document.getElementById('cancel-request').addEventListener('click', function (e) {
    e.preventDefault();
    confirmCancel();
});
document.getElementById('submit-another').addEventListener('click', function () {
    resetForm();
});

// ================================================================
// CHANGED: This is the new submit function with Supabase upload
// ================================================================
document.getElementById('submit-request').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!validateField()) {
        const summary = document.getElementById('form-error');
        if (summary) summary.textContent = 'Please fix the highlighted fields before submitting.';
        return;
    }

    const type = document.getElementById('request-type').value.trim();
    const itemName = document.getElementById('item-name').value.trim();
    const amount = parseFloat(document.getElementById('amount').value.trim());
    const description = document.getElementById('description').value.trim();
    const budgetForm = document.getElementById('budget-form').files[0];
    const meetingMinutes = document.getElementById('meeting-minutes').files[0];
    const vendorQuotation = document.getElementById('vendor-quotation').files[0];

    const btn = document.getElementById('submit-request');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        // 1. Get the Firebase JWT token (required for your private bucket)
        const user = auth.currentUser;
        if (!user) throw new Error('User not logged in.');
        const firebaseToken = await user.getIdToken();

        // 2. Helper function to upload one file to Supabase
        const uploadFile = async (file, fileType) => {
            if (!file) return null;
            const timestamp = Date.now();
            const path = `requests/${userUid}/${timestamp}_${file.name}`;
            const { data, error } = await window.supabaseClient.storage
                .from('documents')
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: false,
                    headers: {
                        Authorization: `Bearer ${firebaseToken}`
                    }
                });
            if (error) throw new Error(`Failed to upload ${fileType}: ${error.message}`);
            return data.path; // Returns the file path in Supabase
        };

        // 3. Upload all three files to Supabase
        const budgetPath = await uploadFile(budgetForm, 'Budget Form');
        const minutesPath = await uploadFile(meetingMinutes, 'Meeting Minutes');
        const quotationPath = await uploadFile(vendorQuotation, 'Vendor Quotation');

        // 4. Save the request metadata (with file paths) to Firestore
        const requestData = {
            type,
            itemName,
            amount,
            description,
            status: 'Submitted',
            submittedBy: userUid,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            societyName: document.getElementById('society-name').value || 'Your Society',
            documents: {
                budgetForm: budgetPath,      // Now storing the Supabase path
                meetingMinutes: minutesPath,
                vendorQuotation: quotationPath
            }
        };

        await db.collection('requests').add(requestData);
        document.getElementById('form-section').classList.add('hidden');
        document.getElementById('success-section').classList.remove('hidden');

    } catch (error) {
        console.error('Error submitting request:', error);
        const summary = document.getElementById('form-error');
        if (summary) summary.textContent = 'Error: ' + error.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Request';
    }
});

validateField();