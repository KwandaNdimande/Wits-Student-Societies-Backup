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

// ============ NUMBERS-ONLY CHECK ============
function isNumbersOnly(value) {
    if (!value || value.trim() === '') return false;
    return !/[a-zA-Z]/.test(value);
}

// ============ VALIDATION ============
function isFieldValid(fieldId, value) {
    switch (fieldId) {
        case 'request-type':
            return value && value.trim() !== '';
        case 'item-name':
            return value && value.trim() !== '' && !isNumbersOnly(value);
        case 'amount':
            const num = parseFloat(value);
            return !isNaN(num) && num >= 100;
        case 'description':
            return value && value.trim() !== '' && !isNumbersOnly(value);
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

// ============ ASTERISK UPDATE ============
function updateAsteriskForField(fieldId) {
    const mapping = {
        'request-type': { input: 'request-type', key: 'type' },
        'item-name': { input: 'item-name', key: 'item' },
        'amount': { input: 'amount', key: 'amount' },
        'description': { input: 'description', key: 'description' },
        'budget-form': { input: 'budget-form', key: 'budget' },
        'meeting-minutes': { input: 'meeting-minutes', key: 'meeting' },
        'vendor-quotation': { input: 'vendor-quotation', key: 'quotation' },
    };

    const map = mapping[fieldId];
    if (!map) return;

    const valid = isFieldValid(map.input, document.getElementById(map.input).value);

    if (valid) {
        hideAsterisk(map.key);
    } else {
        showAsterisk(map.key);
    }
}

// ============ REAL-TIME WARNING (Event/Item Name & Description) ============
function updateNumbersOnlyWarning(inputId, warningId) {
    const input = document.getElementById(inputId);
    const warning = document.getElementById(warningId);
    if (!input || !warning) return;

    const value = input.value;
    if (value.trim() !== '' && isNumbersOnly(value)) {
        warning.textContent = 'Error: This field cannot contain numbers only.';
        warning.classList.add('show');
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
    } else {
        warning.textContent = '';
        warning.classList.remove('show');
        input.classList.remove('error');
        input.removeAttribute('aria-invalid');
    }
}

// ============ PROGRESS AND BUTTON STATE ============
function updateProgress() {
    const fields = [
        { inputId: 'request-type' },
        { inputId: 'item-name' },
        { inputId: 'amount' },
        { inputId: 'description' },
        { inputId: 'budget-form' },
        { inputId: 'meeting-minutes' },
        { inputId: 'vendor-quotation' }
    ];

    const completed = fields.filter(field => {
        const input = document.getElementById(field.inputId);
        return input && isFieldValid(field.inputId, input.value);
    }).length;

    const total = fields.length;
    const percent = Math.round((completed / total) * 100);
    const isSubmitting = submitBtn.textContent === 'Submitting...';

    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressCount').textContent =
        `${completed} / ${total} fields complete`;

    submitBtn.disabled = isSubmitting || completed !== total;
}

function updateFormState() {
    // Update all asterisks
    updateAsteriskForField('request-type');
    updateAsteriskForField('item-name');
    updateAsteriskForField('amount');
    updateAsteriskForField('description');
    updateAsteriskForField('budget-form');
    updateAsteriskForField('meeting-minutes');
    updateAsteriskForField('vendor-quotation');

    // Update warnings
    updateNumbersOnlyWarning('item-name', 'item-warning');
    updateNumbersOnlyWarning('description', 'description-warning');

    // Update amount error
    updateAmountError();

    // Update progress + button state
    updateProgress();

    // Clear any old error summary if form is valid
    if (isFormValid()) {
        errorSummary.textContent = '';
        errorSummary.classList.remove('show');
    }
}

// ============ AMOUNT ERROR MESSAGE ============
function updateAmountError() {
    const amountInput = document.getElementById('amount');
    const errorEl = document.getElementById('amount-error');
    const value = amountInput.value.trim();

    if (value === '') {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
        amountInput.classList.remove('error');
        amountInput.removeAttribute('aria-invalid');
        return;
    }

    const num = parseFloat(value);
    if (isNaN(num) || num < 100) {
        errorEl.textContent = 'Error: Enter a valid amount. Must be at least R100.';
        errorEl.classList.add('show');
        amountInput.classList.add('error');
        amountInput.setAttribute('aria-invalid', 'true');
    } else {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
        amountInput.classList.remove('error');
        amountInput.removeAttribute('aria-invalid');
    }
}

// ============ CLEAR ALL ERRORS ============
function clearAllErrors() {
    document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(el => {
        el.classList.remove('error');
        el.removeAttribute('aria-invalid');
    });
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
    document.querySelectorAll('.field-warning').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
    errorSummary.textContent = '';
    errorSummary.classList.remove('show');
}

// ============ RESET FORM ============
function resetForm() {
    document.getElementById('request-type').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';

    document.querySelectorAll('#form-section input[type="file"]').forEach(input => {
        input.value = '';
    });

    clearAllErrors();

    submitBtn.textContent = 'Submit Request';

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

    if (!isFormValid()) {
        updateFormState();
        return;
    }

    clearAllErrors();

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

        document.getElementById('form-section').classList.add('hidden');
        document.getElementById('success-section').classList.remove('hidden');

    } catch (error) {
        console.error('Error submitting request:', error);

        errorSummary.textContent =
            'We could not confirm submission. Check My Requests before trying again to avoid creating a duplicate. If the request is not listed, check your connection and retry.';

        errorSummary.classList.add('show');

        submitBtn.textContent = 'Submit Request';
        updateProgress();

        errorSummary.focus({ preventScroll: true });
        errorSummary.scrollIntoView({
            behavior: 'auto',
            block: 'center'
        });
    }
});

// ============ INITIAL STATE ============
updateFormState();