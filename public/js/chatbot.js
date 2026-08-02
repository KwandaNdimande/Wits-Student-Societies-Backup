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

// If not logged in, redirect to login
if (!userUid) {
    window.location.href = '/login.html';
}

// Update navigation based on role
function updateNavigation() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    if (userRole === 'officer') {
        // Officer navigation
        navLinks.innerHTML = `
            <a href="/officer/dashboard.html">Dashboard</a>
            <a href="/officer/announcements.html">Announcements</a>
            <a href="/officer/all-requests.html">All Requests</a>
            <a href="/officer/societies.html">Manage Societies</a>
            <a href="/officer/reports.html">Reports</a>
            <a href="/chatbot.html" class="active">SGO Assistant</a>
            <a href="/officer/documents.html">Documents</a>
            <a href="/login.html">Logout</a>
        `;
    } else {
        // Leader navigation (default)
        navLinks.innerHTML = `
            <a href="/leader/dashboard.html">Dashboard</a>
            <a href="/leader/announcements.html">Announcements</a>
            <a href="/leader/my-requests.html">My Requests</a>
            <a href="/leader/new-request.html">New Request</a>
            <a href="/leader/documents.html">Documents</a>
            <a href="/chatbot.html" class="active">SGO Assistant</a>
            <a href="/login.html">Logout</a>
        `;
    }
}

// Responses database
const responses = {
    "submit": "To submit a request, go to Submit Request in the navigation menu. You will need your Budget Form, Meeting Minutes, and Vendor Quotation in PDF format.",
    "document": "You need three documents: a Budget Form, Meeting Minutes signed by your executive, and a Vendor Quotation. Download the templates from the Document Repository.",
    "status": "You can check your request status on the My Requests page. Statuses are colour-coded: blue for Submitted, yellow for Under Review, green for Approved, and red for Rejected.",
    "contact": "You can contact the SGO office directly at sgo@wits.ac.za or visit Room 101, Senate House, Wits University.",
    "budget": "Budget requests are submitted through the Submit Request page. Include the amount, purpose, and required documents.",
    "regalia": "Regalia requests are for society branded items like T-shirts, jackets, or other merchandise. Submit through the Submit Request page.",
    "approval": "Once approved, you will receive a notification. Approved requests are typically processed within 5-7 business days.",
    "revision": "If your request is marked 'Revision Required', check the feedback from SGO and resubmit with the requested changes.",
    "deadline": "Budget deadlines are posted in announcements. Please check the Announcements page for current deadlines."
};

// State
let messages = [
    { from: "bot", text: "Hi! I'm the Wits SGO assistant. Ask me about submitting requests, required documents, or checking your status." }
];
let typing = false;

// DOM elements
const messagesContainer = document.getElementById('chat-messages');
const inputField = document.getElementById('chat-input');

// Render messages
function renderMessages() {
    messagesContainer.innerHTML = messages.map((m, i) => {
        const className = m.from === 'user' ? 'message user' : 'message bot';
        return `<div key="${i}" class="${className}">${m.text}</div>`;
    }).join('');

    if (typing) {
        messagesContainer.innerHTML += `<div class="message typing">Typing...</div>`;
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message
function sendMessage() {
    const userMsg = inputField.value.trim();
    if (!userMsg) return;

    messages.push({ from: "user", text: userMsg });
    inputField.value = '';
    typing = true;
    renderMessages();

    // Find response
    let reply = "I'm not sure about that. Please contact the SGO office directly at sgo@wits.ac.za";
    const lowerMsg = userMsg.toLowerCase();
    
    for (const [key, value] of Object.entries(responses)) {
        if (lowerMsg.includes(key)) {
            reply = value;
            break;
        }
    }

    // Simulate bot response
    setTimeout(() => {
        messages.push({ from: "bot", text: reply });
        typing = false;
        renderMessages();
    }, 800);
}

// Enter key support
if (inputField) {
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Update navigation when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateNavigation();
    // Remove the hardcoded nav-links from HTML and let JS handle it
});

// Initial render
renderMessages();