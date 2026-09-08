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

// Check authentication and role
const userUid = localStorage.getItem('userUid');
const userRole = localStorage.getItem('userRole');
const userName = localStorage.getItem('userName') || 'Guest';

// If not logged in, redirect to login
if (!userUid) {
    window.location.href = '/login.html';
}

// ============================================
// KNOWLEDGE BASE
// ============================================
const knowledgeBase = [
    {
        keywords: ['required', 'need', 'documents', 'what do i need', 'what is required', 'budget form', 'meeting minutes', 'vendor quotation', 'requirements', 'paperwork'],
        category: 'requirements',
        answer: `DOCUMENTS REQUIRED FOR BUDGET REQUEST

You need three documents:

1. Budget Form — completed with amounts, items, and purpose
2. Meeting Minutes — signed by your society's executive committee, showing budget approval
3. Vendor Quotation — at least 3 quotes from different suppliers

All documents must be in PDF format.

You can find templates in the Document Repository.`
    },
    {
        keywords: ['prepare', 'supporting documents', 'how do i prepare', 'format', 'pdf', 'quotation', 'meeting minutes', 'budget form template'],
        category: 'preparation',
        answer: `PREPARING SUPPORTING DOCUMENTS

Budget Form:
- List each expense item with estimated costs
- Include purpose/justification for each item
- Ensure totals are correct

Meeting Minutes:
- Show executive committee approved the budget request
- Include meeting date and signatures
- Must be on your society's letterhead

Vendor Quotations:
- Get at least 3 quotes from reputable suppliers
- Include item descriptions and prices
- Quote must be valid for at least 30 days

All documents must be in PDF format.`
    },
    {
        keywords: ['budget form', 'download budget form', 'where to get budget form', 'template', 'document repository'],
        category: 'form',
        answer: `BUDGET FORM TEMPLATE

You can download the Budget Form from the Document Repository in the navigation menu.

The form includes:
- Society name and date
- Expense items with amounts
- Purpose description for each item
- Executive signatures section

Complete all sections before submitting.`
    },
    {
        keywords: ['submit', 'how to submit', 'submission process', 'upload', 'submit request'],
        category: 'submission',
        answer: `HOW TO SUBMIT A BUDGET REQUEST

1. Complete the Budget Form
2. Get Meeting Minutes signed by executive committee
3. Obtain Vendor Quotations (3 quotes)
4. Go to Submit Request in the navigation menu
5. Upload all three documents (PDF format)
6. Fill in request details and purpose
7. Click Submit to send to SGO

You will receive a confirmation once submitted.`
    },
    {
        keywords: ['limit', 'maximum', 'how much', 'budget limit', 'amount limit', 'max amount'],
        category: 'amount',
        answer: `BUDGET REQUEST AMOUNTS

Budget requests are evaluated on a case-by-case basis:

- No fixed maximum amount
- Amount must be justified in your Budget Form
- Must align with your society's activities
- Supported by Meeting Minutes and Vendor Quotations

SGO reviews each request based on merit and available funding.`
    },
    {
        keywords: ['how long', 'timeline', 'processing time', 'approval time', 'how long does it take', 'when will i know', 'wait'],
        category: 'timeline',
        answer: `PROCESSING TIMELINE

Budget requests are processed within:
- 5-7 business days for standard requests
- You can check status on My Requests page
- You will receive a notification when:
  - Approved
  - Rejected
  - Revision Required

Contact SGO if it has been longer than 7 business days.`
    },
    {
        keywords: ['status', 'check status', 'my requests', 'where to see status', 'track request', 'request status'],
        category: 'status',
        answer: `CHECK YOUR REQUEST STATUS

Go to My Requests in the navigation menu.

Statuses are colour-coded:
- Submitted — Pending review
- Under Review — SGO is reviewing
- Approved — Request approved
- Rejected — Request declined
- Revision Required — Changes needed

Click on any request for detailed information.`
    },
    {
        keywords: ['revision', 'sent back', 'rejected', 'changes needed', 'resubmit', 'revision required', 'my request needs', 'changes'],
        category: 'revision',
        answer: `REQUEST REVISIONS

If your request is marked "Revision Required":
1. Check the SGO feedback in your request details
2. Make the requested changes to your Budget Form or documents
3. Go to Submit Request and upload the revised documents
4. Add a note explaining what you changed
5. Click Submit to send for re-review

SGO will re-review your revised request within 3-5 business days.`
    },
    {
        keywords: ['contact', 'sgo', 'email', 'office', 'phone', 'help', 'who do i contact', 'where is sgo', 'sgo office'],
        category: 'contact',
        answer: `CONTACT THE SGO OFFICE

Email: sgo@wits.ac.za

Location: Room 101, Senate House, Wits University

Office Hours: Monday-Friday, 9:00 AM - 4:00 PM

Phone: Available via email request

SGO is here to help with all your society funding questions.`
    }
];

// ============================================
// CATEGORIES FOR QUICK REPLIES
// ============================================
const categories = [
    {
        id: 'budget',
        label: 'Budget Requests',
        questions: [
            'What documents are required for a budget request?',
            'How do I prepare the supporting documents?',
            'Where can I get the Budget Form?',
            'How do I submit a budget request?',
            'Is there a budget limit?'
        ]
    },
    {
        id: 'status',
        label: 'Request Status',
        questions: [
            'How do I check my request status?',
            'What do the status colours mean?',
            'How long does it take to get approved?'
        ]
    },
    {
        id: 'revisions',
        label: 'Revisions',
        questions: [
            'My request was sent back. What do I do?',
            'How do I resubmit a revised request?',
            'What happens after I resubmit?'
        ]
    },
    {
        id: 'contact',
        label: 'Contact SGO',
        questions: [
            'How do I contact the SGO office?',
            'Where is the SGO office located?',
            'What are SGO office hours?'
        ]
    }
];

// ============================================
// APPLICATION STATE
// ============================================
let messages = [];
let showCategoryReplies = true;
let currentCategory = null;
let typing = false;
let hasInteracted = false;
let isClosing = false;

// ============================================
// DOM ELEMENTS
// ============================================
const messagesContainer = document.getElementById('chat-messages');
const inputField = document.getElementById('chat-input');

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderMessages() {
    let html = messages.map((m, i) => {
        let messageHtml = `<div class="message ${m.from === 'user' ? 'user' : 'bot'}">${m.text}</div>`;
        
        if (m.from === 'bot' && i === messages.length - 1 && !isClosing) {
            if (currentCategory) {
                messageHtml += renderQuestions(currentCategory);
            } else if (showCategoryReplies && !hasInteracted) {
                messageHtml += renderCategories();
            } else if (hasInteracted && !currentCategory) {
                messageHtml += renderActionButtons();
            }
        }
        
        return messageHtml;
    }).join('');

    if (typing) {
        html += `<div class="message typing">Typing...</div>`;
    }

    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderCategories() {
    let html = `<div class="quick-replies">`;
    categories.forEach(cat => {
        html += `
            <button class="quick-reply-btn category-btn" onclick="selectCategory('${cat.id}')">
                ${cat.label}
            </button>
        `;
    });
    html += `</div>`;
    return html;
}

function renderQuestions(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';

    let html = `<div class="quick-replies">`;
    html += `
        <button class="quick-reply-btn back-btn" onclick="goBack()">
            ← Back
        </button>
    `;
    category.questions.forEach(q => {
        html += `
            <button class="quick-reply-btn question-btn" onclick="sendQuickReply('${q.replace(/'/g, "\\'")}')">
                ${q}
            </button>
        `;
    });
    html += `</div>`;
    return html;
}

function renderActionButtons() {
    return `
        <div class="quick-replies" style="margin-top: 12px;">
            <button class="quick-reply-btn category-btn" onclick="goBackToCategories()" style="flex: 1 0 calc(50% - 4px); text-align: center;">
                Back to Categories
            </button>
            <button class="quick-reply-btn close-btn" onclick="closeChat()" style="flex: 1 0 calc(50% - 4px); text-align: center;">
                Close
            </button>
        </div>
    `;
}

// ============================================
// NAVIGATION FUNCTIONS
// ============================================

function selectCategory(categoryId) {
    currentCategory = categoryId;
    const category = categories.find(c => c.id === categoryId);
    
    messages.push({
        from: 'bot',
        text: `${category.label} — What would you like to know?`
    });
    showCategoryReplies = false;
    hasInteracted = true;
    renderMessages();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function goBack() {
    currentCategory = null;
    showCategoryReplies = false;
    
    messages.push({
        from: 'bot',
        text: 'What would you like to do?'
    });
    renderMessages();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function goBackToCategories() {
    currentCategory = null;
    showCategoryReplies = true;
    hasInteracted = false;
    
    messages.push({
        from: 'bot',
        text: 'Please select a category:'
    });
    renderMessages();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================
// CLOSE CHAT FUNCTION
// ============================================
function closeChat() {
    if (isClosing) return;
    isClosing = true;
    
    messages.push({
        from: 'bot',
        text: `Thank you for using the SGO Assistant, ${userName}. Redirecting to dashboard...`
    });
    renderMessages();
    
    setTimeout(() => {
        window.location.href = '/dashboard.html';
    }, 1500);
}

// ============================================
// CORE CHAT FUNCTIONS
// ============================================

function findAnswer(userMsg) {
    const lowerMsg = userMsg.toLowerCase();
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const entry of knowledgeBase) {
        let score = 0;
        for (const keyword of entry.keywords) {
            if (lowerMsg.includes(keyword.toLowerCase())) {
                score++;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
        }
    }
    
    if (bestMatch && bestScore > 0) {
        return bestMatch.answer;
    }
    
    return `I could not find an answer to your question in my knowledge base.

Please try:
1. Clicking "Back to Categories" below
2. Contacting the SGO office directly at sgo@wits.ac.za
3. Visiting Room 101, Senate House (Mon-Fri, 9AM-4PM)

I am here to help with budget-related questions.`;
}

function sendMessage() {
    const userMsg = inputField.value.trim();
    if (!userMsg || isClosing) return;

    messages.push({ from: "user", text: userMsg });
    inputField.value = '';
    showCategoryReplies = false;
    currentCategory = null;
    hasInteracted = true;
    typing = true;
    renderMessages();

    setTimeout(() => {
        const reply = findAnswer(userMsg);
        messages.push({ from: "bot", text: reply });
        typing = false;
        renderMessages();
    }, 600);
}

function sendQuickReply(query) {
    if (isClosing) return;
    
    messages.push({ from: "user", text: query });
    showCategoryReplies = false;
    currentCategory = null;
    hasInteracted = true;
    typing = true;
    renderMessages();

    setTimeout(() => {
        const reply = findAnswer(query);
        messages.push({ from: "bot", text: reply });
        typing = false;
        renderMessages();
    }, 600);
}

// ============================================
// EVENT LISTENERS
// ============================================

if (inputField) {
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// ============================================
// INITIALIZATION
// ============================================

messages.push({
    from: "bot",
    text: `Hello ${userName}. I am the SGO Budget Assistant.

I can help you with:
- Budget requests
- Required documents
- Request status
- Revisions
- Contacting SGO

Select a category below or type your question:`
});

renderMessages();