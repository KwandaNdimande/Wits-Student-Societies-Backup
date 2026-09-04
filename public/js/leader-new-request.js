// ---------- SUPABASE INITIALIZATION ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';

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

let currentUser = null;
let userUid = localStorage.getItem('userUid');

if (!userUid) {
    window.location.href = '/login.html';
}

// Load user data
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('society-name').value = userData.societyName || 'Your Society';
        }
    } else {
        window.location.href = '/login.html';
    }
});

// ============ DOM REFS ============
const submitBtn = document.getElementById('submit-request');
const cancelBtn = document.getElementById('cancel-request');
const errorSummary = document.getElementById('form-error');

// ============ ASTERISK HELPERS ============
const asterisks = {
    type: document.getElementById('req-type'),
    item: document.getElementById('req-item'),
    amount: document.getElementById('req-amount'),
    description: document.getElementById('req-description'),
    budget: document.getElementById('req-budget'),
    meeting: document.getElementById('req-meeting'),
    quotation: document.getElementById('req-quotation'),
};

function showAsterisk(key) {
    if (asterisks[key]) asterisks[key].classList.remove('hidden');
}

function hideAsterisk(key) {
    if (asterisks[key]) asterisks[key].classList.add('hidden');
}

function updateAsterisk(key, value) {
    if (value && value.toString().trim().length > 0) {
        hideAsterisk(key);
    } else {
        showAsterisk(key);
    }
}

// ============ VALIDATION ============
// Helper function to validate text fields (name, description, etc.)
// Must contain at least one letter; reject numeric-only values
function isValidTextField(value) {
    const text = String(value || '').trim();
    if (!text || text.length === 0) return false;
    // Must contain at least one letter (a-z, A-Z)
    if (!/[a-zA-Z]/.test(text)) return false;
    return true;
}

function isFieldValid(fieldId, value) {
    switch (fieldId) {
        case 'request-type':
            return value && value.trim() !== '';
        case 'item-name':
            return isValidTextField(value);
        case 'amount':
            const num = parseFloat(value);
            return !isNaN(num) && num > 0;
        case 'description':
            return isValidTextField(value);
        case 'budget-form':
            const fileB = document.getElementById('budget-form').files[0];
            return fileB && /\.(xlsx|xls)$/i.test(fileB.name);
        case 'meeting-minutes':
            const fileM = document.getElementById('meeting-minutes').files[0];
            return fileM && /\.pdf$/i.test(fileM.name);
        case 'vendor-quotation':
            const fileQ = document.getElementById('vendor-quotation').files[0];
            return fileQ && /\.pdf$/i.test(fileQ.name);
        default:
            return true;
    }
}

function isFormValid() {
    const type = document.getElementById('request-type').value;
    const item = document.getElementById('item-name').value;
    const amount = document.getElementById('amount').value;
    const desc = document.getElementById('description').value;

    return isFieldValid('request-type', type) &&
           isFieldValid('item-name', item) &&
           isFieldValid('amount', amount) &&
           isFieldValid('description', desc) &&
           isFieldValid('budget-form') &&
           isFieldValid('meeting-minutes') &&
           isFieldValid('vendor-quotation');
}

function updateFormState() {
    // Update asterisks
    updateAsterisk('type', document.getElementById('request-type').value);
    updateAsterisk('item', document.getElementById('item-name').value);
    updateAsterisk('amount', document.getElementById('amount').value);
    updateAsterisk('description', document.getElementById('description').value);
    updateAsterisk('budget', document.getElementById('budget-form').files[0] ? document.getElementById('budget-form').files[0].name : '');
    updateAsterisk('meeting', document.getElementById('meeting-minutes').files[0] ? document.getElementById('meeting-minutes').files[0].name : '');
    updateAsterisk('quotation', document.getElementById('vendor-quotation').files[0] ? document.getElementById('vendor-quotation').files[0].name : '');

    // Enable/disable submit button
    const valid = isFormValid();
    submitBtn.disabled = !valid;

    // If valid, hide any previous error summary
    if (valid) {
        errorSummary.classList.remove('show');
        errorSummary.textContent = '';
    }
}

// ============ CLEAR & SHOW ERRORS (only on submit) ============
function clearAllErrors() {
    document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(el => {
        el.classList.remove('error');
    });
    document.querySelectorAll('.field-error').forEach(el => {
        el.classList.remove('show');
    });
    errorSummary.classList.remove('show');
    errorSummary.textContent = '';
}

function showFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    if (input) input.classList.add('error');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function validateAllFields() {
    clearAllErrors();
    let isValid = true;

    const type = document.getElementById('request-type').value;
    if (!type || type.trim() === '') {
        showFieldError('request-type', 'type-error', 'Request type is required.');
        isValid = false;
    }

    const item = document.getElementById('item-name').value.trim();
    if (!isValidTextField(item)) {
        showFieldError('item-name', 'item-error', 'Event or item name must contain at least one letter.');
        isValid = false;
    }

    const amountVal = document.getElementById('amount').value.trim();
    const amount = parseFloat(amountVal);
    if (!amountVal || isNaN(amount) || amount <= 0) {
        showFieldError('amount', 'amount-error', 'Amount requested is required and must be greater than zero.');
        isValid = false;
    }

    const desc = document.getElementById('description').value.trim();
    if (!isValidTextField(desc)) {
        showFieldError('description', 'description-error', 'Description must contain at least one letter.');
        isValid = false;
    }

    const budgetFile = document.getElementById('budget-form').files[0];
    if (!budgetFile) {
        showFieldError('budget-form', 'budget-error', 'Budget Form is required.');
        isValid = false;
    } else if (!/\.(xlsx|xls)$/i.test(budgetFile.name)) {
        showFieldError('budget-form', 'budget-error', 'Budget Form must be an Excel file (.xlsx or .xls).');
        isValid = false;
    }

    const meetingFile = document.getElementById('meeting-minutes').files[0];
    if (!meetingFile) {
        showFieldError('meeting-minutes', 'meeting-error', 'Meeting Minutes are required.');
        isValid = false;
    } else if (!/\.pdf$/i.test(meetingFile.name)) {
        showFieldError('meeting-minutes', 'meeting-error', 'Meeting Minutes must be a PDF file.');
        isValid = false;
    }

    const quotationFile = document.getElementById('vendor-quotation').files[0];
    if (!quotationFile) {
        showFieldError('vendor-quotation', 'quotation-error', 'Vendor Quotation is required.');
        isValid = false;
    } else if (!/\.pdf$/i.test(quotationFile.name)) {
        showFieldError('vendor-quotation', 'quotation-error', 'Vendor Quotation must be a PDF file.');
        isValid = false;
    }

    if (!isValid) {
        errorSummary.textContent = 'Please fix the highlighted fields before submitting.';
        errorSummary.classList.add('show');
    }

    return isValid;
}

// ============ RESET FORM ============
function resetForm() {
    document.getElementById('request-type').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
    clearAllErrors();
    document.getElementById('form-section').classList.remove('hidden');
    document.getElementById('success-section').classList.add('hidden');
    updateFormState();
}

// ============ EVENT LISTENERS ============
document.getElementById('request-type').addEventListener('input', updateFormState);
document.getElementById('item-name').addEventListener('input', updateFormState);
document.getElementById('amount').addEventListener('input', updateFormState);
document.getElementById('description').addEventListener('input', updateFormState);
document.getElementById('budget-form').addEventListener('change', updateFormState);
document.getElementById('meeting-minutes').addEventListener('change', updateFormState);
document.getElementById('vendor-quotation').addEventListener('change', updateFormState);

// Cancel button
cancelBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (confirm('Are you sure you want to discard this request?')) {
        resetForm();
        window.location.href = '/leader/dashboard.html';
    }
});

// Submit another after success
document.getElementById('submit-another').addEventListener('click', function () {
    resetForm();
});

// ============ SUBMIT ============
submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    // Double-check validation (button should be enabled only if valid, but we validate again for safety)
    if (!isFormValid()) {
        validateAllFields();
        return;
    }

    // Clear any old errors
    clearAllErrors();

    // Disable button to prevent double submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const type = document.getElementById('request-type').value.trim();
    const itemName = document.getElementById('item-name').value.trim();
    const amount = parseFloat(document.getElementById('amount').value.trim());
    const description = document.getElementById('description').value.trim();
    const budgetForm = document.getElementById('budget-form').files[0];
    const meetingMinutes = document.getElementById('meeting-minutes').files[0];
    const vendorQuotation = document.getElementById('vendor-quotation').files[0];

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User not logged in.');
        const firebaseToken = await user.getIdToken();

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
            return data.path;
        };

        const budgetPath = await uploadFile(budgetForm, 'Budget Form');
        const minutesPath = await uploadFile(meetingMinutes, 'Meeting Minutes');
        const quotationPath = await uploadFile(vendorQuotation, 'Vendor Quotation');

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
                budgetForm: budgetPath,
                meetingMinutes: minutesPath,
                vendorQuotation: quotationPath
            }
        };

        await db.collection('requests').add(requestData);

        // Success – show success page
        document.getElementById('form-section').classList.add('hidden');
        document.getElementById('success-section').classList.remove('hidden');

    } catch (error) {
        console.error('Error submitting request:', error);
        errorSummary.textContent = 'Error: ' + error.message;
        errorSummary.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    }
});

// ============ INITIAL STATE ============
updateFormState();