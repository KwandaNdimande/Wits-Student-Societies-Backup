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
function isFieldValid(fieldId, value) {
    switch (fieldId) {
        case 'request-type':
            return value && value.trim() !== '';
        case 'item-name':
            return value && value.trim() !== '';
        case 'amount':
            const num = parseFloat(value);
            return !isNaN(num) && num >= 100;
        case 'description':
            return value && value.trim() !== '';
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

// ============ FIELD FEEDBACK ============

const inlineValidationFields = [
    {
        inputId: 'request-type',
        errorId: 'type-error',
        message: 'Select a request type.'
    },
    {
        inputId: 'item-name',
        errorId: 'item-error',
        message: 'Enter the event or item name.'
    },
    {
        inputId: 'amount',
        errorId: 'amount-error',
        message: () => {
            const hint = document.querySelector(
                '#group-amount .form-hint'
            );

            return 'Enter a valid amount. ' +
                (hint ? hint.textContent.trim() : '');
        }
    },
    {
        inputId: 'description',
        errorId: 'description-error',
        message: 'Describe what the requested funds will be used for.'
    },
    {
        inputId: 'budget-form',
        errorId: 'budget-error',
        message: 'Upload the budget form as an Excel file (.xlsx or .xls).'
    },
    {
        inputId: 'meeting-minutes',
        errorId: 'meeting-error',
        message: 'Upload the meeting minutes as a PDF file.'
    },
    {
        inputId: 'vendor-quotation',
        errorId: 'quotation-error',
        message: 'Upload the vendor quotation as a PDF file.'
    }
];

const touchedFields = new Set();

function validateOneField(field) {
    const input = document.getElementById(field.inputId);
    const error = document.getElementById(field.errorId);

    if (!input || !error) return false;

    const valid = Boolean(
        isFieldValid(field.inputId, input.value)
    );

    const message = typeof field.message === 'function'
        ? field.message()
        : field.message;

    input.classList.toggle('error', !valid);
    input.setAttribute('aria-invalid', String(!valid));

    error.textContent = valid ? '' : `Error: ${message}`;
    error.classList.toggle('show', !valid);

    return valid;
}

function clearAllErrors() {
    inlineValidationFields.forEach(field => {
        const input = document.getElementById(field.inputId);
        const error = document.getElementById(field.errorId);

        if (input) {
            input.classList.remove('error');
            input.removeAttribute('aria-invalid');
        }

        if (error) {
            error.textContent = '';
            error.classList.remove('show');
        }
    });

    errorSummary.textContent = '';
    errorSummary.classList.remove('show');
}

function validateAllFields() {
    let valid = true;

    inlineValidationFields.forEach(field => {
        touchedFields.add(field.inputId);

        if (!validateOneField(field)) {
            valid = false;
        }
    });

    if (!valid) {
        errorSummary.textContent =
            'Your request has not been submitted. Correct the fields marked with an error.';
        errorSummary.classList.add('show');
    } else {
        errorSummary.textContent = '';
        errorSummary.classList.remove('show');
    }

    return valid;
}

// ============ PROGRESS AND BUTTON STATE ============

function updateProgress() {
    const completed = inlineValidationFields.filter(field => {
        const input = document.getElementById(field.inputId);

        return input && isFieldValid(field.inputId, input.value);
    }).length;

    const total = inlineValidationFields.length;
    const percent = Math.round((completed / total) * 100);
    const isSubmitting = submitBtn.textContent === 'Submitting...';

    document.getElementById('progressFill').style.width =
        `${percent}%`;

    document.getElementById('progressCount').textContent =
        `${completed} / ${total} fields complete`;

    submitBtn.disabled = isSubmitting || completed !== total;

    const help = document.getElementById('submit-help');

    if (help) {
        help.textContent = isSubmitting
            ? 'Submitting your request. Please wait.'
            : completed === total
                ? 'All required fields are complete. You can submit your request.'
                : 'Complete all required fields correctly to enable Submit Request.';
    }
}

function updateFormState() {
    // Asterisks always identify required fields.
    Object.keys(asterisks).forEach(showAsterisk);

    // Only show errors for fields already visited.
    inlineValidationFields.forEach(field => {
        if (touchedFields.has(field.inputId)) {
            validateOneField(field);
        }
    });

    updateProgress();
}

// ============ CONNECT ERRORS TO INPUTS ============

function initialiseInlineValidation() {
    inlineValidationFields.forEach(field => {
        const input = document.getElementById(field.inputId);

        if (!input) return;

        let error = document.getElementById(field.errorId);

        // Create an error container if one is missing.
        if (!error) {
            error = document.createElement('div');
            error.id = field.errorId;
            error.className = 'field-error';
            input.insertAdjacentElement('afterend', error);
        }

        error.textContent = '';
        error.classList.remove('show');
        error.setAttribute('aria-live', 'polite');
        error.setAttribute('aria-atomic', 'true');

        input.setAttribute('aria-required', 'true');

        const descriptionIds = new Set(
            (input.getAttribute('aria-describedby') || '')
                .split(/\s+/)
                .filter(Boolean)
        );

        descriptionIds.add(field.errorId);

        input.setAttribute(
            'aria-describedby',
            [...descriptionIds].join(' ')
        );

        // Leaving a field triggers its validation.
        input.addEventListener('blur', () => {
            touchedFields.add(field.inputId);
            updateFormState();
        });

        // Correcting a visited field refreshes its error.
        input.addEventListener('input', updateFormState);

        // Check selected files and dropdown values immediately.
        input.addEventListener('change', () => {
            touchedFields.add(field.inputId);
            updateFormState();
        });
    });

    errorSummary.setAttribute('role', 'alert');
    errorSummary.setAttribute('tabindex', '-1');
}

initialiseInlineValidation();

// ============ RESET FORM ============

function resetForm() {
    document.getElementById('request-type').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';

    document.querySelectorAll(
        '#form-section input[type="file"]'
    ).forEach(input => {
        input.value = '';
    });

    touchedFields.clear();
    clearAllErrors();

    submitBtn.textContent = 'Submit Request';

    document.getElementById('form-section')
        .classList.remove('hidden');

    document.getElementById('success-section')
        .classList.add('hidden');

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
    if (!validateAllFields()) {
    updateFormState();
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