/* =========================================================
   FIREBASE CONFIGURATION
   ========================================================= */

const firebaseConfig = {
    // KEEP YOUR EXISTING FIREBASE CONFIG HERE
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();


/* =========================================================
   CHATBOT KNOWLEDGE BASE
   ========================================================= */

const knowledgeBase = {

    requiredDocuments: {
        question: "What documents do I need for a budget request?",

        answer: `
            <strong>Budget Request Documents</strong><br><br>

            The required documents are:
            <br><br>

            1. Budget Form<br>
            2. Meeting Minutes signed by the executive<br>
            3. Vendor Quotation
            <br><br>

            Documents should be uploaded as PDF files.
            Templates can be found in the Document Repository.
        `
    },

    preparation: {
        question: "How should I prepare my documents?",

        answer: `
            <strong>Preparing Your Documents</strong><br><br>

            <strong>Budget Form</strong><br>
            Complete the required expense details, justification and totals.
            <br><br>

            <strong>Meeting Minutes</strong><br>
            The minutes should show executive approval, the meeting date
            and the required signatures.
            <br><br>

            <strong>Vendor Quotations</strong><br>
            Include the relevant supplier information, item descriptions
            and prices.
            <br><br>

            Make sure all required documents are complete before submitting
            your request.
        `
    },

    budgetForm: {
        question: "Where can I find the Budget Form?",

        answer: `
            <strong>Budget Form</strong><br><br>

            The Budget Form template is available in the
            <strong>Document Repository</strong>.
            <br><br>

            Complete all required fields before submitting your request.
        `
    },

    submission: {
        question: "How do I submit a budget request?",

        answer: `
            <strong>Submitting a Budget Request</strong><br><br>

            1. Complete the Budget Form.<br>
            2. Obtain the required signed Meeting Minutes.<br>
            3. Obtain the required vendor quotations.<br>
            4. Go to <strong>Submit Request</strong>.<br>
            5. Upload your required documents.<br>
            6. Enter the request details and purpose.<br>
            7. Submit the request.
            <br><br>

            A confirmation should be displayed after successful submission.
        `
    },

    amount: {
        question: "Is there a maximum budget amount?",

        answer: `
            <strong>Budget Amount</strong><br><br>

            There is no fixed maximum amount specified in the current
            chatbot information.
            <br><br>

            The requested amount should be properly justified and aligned
            with the society's activities. Supporting documentation should
            also support the requested amount.
        `
    },

    timeline: {
        question: "How long does a budget request take?",

        answer: `
            <strong>Request Processing</strong><br><br>

            The current chatbot information indicates that standard requests
            may take approximately <strong>5–7 business days</strong>.
            <br><br>

            You can monitor your request through <strong>My Requests</strong>.
            <br><br>

            If your request has not been updated after the expected period,
            contact the SGO for assistance.
        `
    },

    status: {
        question: "How can I check my request status?",

        answer: `
            <strong>Checking Your Request Status</strong><br><br>

            Go to <strong>My Requests</strong> to view your submitted
            requests.
            <br><br>

            Possible statuses include:
            <br><br>

            • Submitted<br>
            • Under Review<br>
            • Approved<br>
            • Rejected<br>
            • Revision Required
            <br><br>

            Select a request to view more information about its status.
        `
    },

    revision: {
        question: "What should I do if revisions are required?",

        answer: `
            <strong>Revision Required</strong><br><br>

            If your request requires revisions:
            <br><br>

            1. Check the feedback provided on the request.<br>
            2. Make the required changes.<br>
            3. Upload the revised documents if necessary.<br>
            4. Add any required notes or explanations.<br>
            5. Resubmit the request.
            <br><br>

            The request will then go through the review process again.
        `
    },

    rejected: {
        question: "What does Rejected mean?",

        answer: `
            <strong>Rejected Request</strong><br><br>

            A rejected request means that the request was not approved.
            <br><br>

            Check the request details and any feedback provided by the SGO
            to understand the reason for the decision.
            <br><br>

            If you need clarification, contact the SGO.
        `
    },

    contact: {
        question: "How can I contact the SGO?",

        answer: `
            <strong>Contact SGO</strong><br><br>

            Email: <strong>sgo@wits.ac.za</strong>
            <br><br>

            Office: <strong>Room 101, Senate House</strong>
            <br><br>

            Office hours: <strong>Monday–Friday, 09:00–16:00</strong>
            <br><br>

            For assistance outside the chatbot's available information,
            please contact the SGO directly.
        `
    }

};


/* =========================================================
   CATEGORIES
   ========================================================= */

const categories = {

    budget: {
        title: "Budget Requests",

        questions: [
            "submission",
            "amount",
            "timeline"
        ]
    },

    documents: {
        title: "Required Documents",

        questions: [
            "requiredDocuments",
            "preparation",
            "budgetForm"
        ]
    },

    status: {
        title: "Request Status",

        questions: [
            "status"
        ]
    },

    revisions: {
        title: "Revisions",

        questions: [
            "revision",
            "rejected"
        ]
    },

    contact: {
        title: "Contact SGO",

        questions: [
            "contact"
        ]
    }

};


/* =========================================================
   STATE
   ========================================================= */

let currentView = "categories";
let isProcessing = false;


/* =========================================================
   DOM
   ========================================================= */

const chatWindow = document.getElementById("chatWindow");
const closeChatButton = document.getElementById("closeChat");


/* =========================================================
   USER
   ========================================================= */

function getUserName() {

    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
        return "there";
    }

    try {

        const user = JSON.parse(storedUser);

        return (
            user.displayName ||
            user.name ||
            user.firstName ||
            "there"
        );

    } catch (error) {

        return "there";

    }
}


/* =========================================================
   MESSAGE RENDERING
   ========================================================= */

function addBotMessage(text) {

    const message = document.createElement("div");

    message.className = "message bot";

    const bubble = document.createElement("div");

    bubble.className = "message-bubble";

    // Static chatbot responses can contain formatting.
    bubble.innerHTML = text;

    message.appendChild(bubble);

    chatWindow.appendChild(message);

    scrollToBottom();
}


function addUserMessage(text) {

    const message = document.createElement("div");

    message.className = "message user";

    const bubble = document.createElement("div");

    bubble.className = "message-bubble";

    // IMPORTANT:
    // User-selected text is inserted using textContent.
    // This prevents HTML injection.
    bubble.textContent = text;

    message.appendChild(bubble);

    chatWindow.appendChild(message);

    scrollToBottom();
}


/* =========================================================
   TYPING INDICATOR
   ========================================================= */

function showTyping() {

    const message = document.createElement("div");

    message.className = "message bot";
    message.id = "typingMessage";

    const typing = document.createElement("div");

    typing.className = "typing";

    typing.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;

    message.appendChild(typing);

    chatWindow.appendChild(message);

    scrollToBottom();
}


function removeTyping() {

    const typingMessage = document.getElementById("typingMessage");

    if (typingMessage) {
        typingMessage.remove();
    }

}


/* =========================================================
   OPTIONS
   ========================================================= */

function clearOptions() {

    const existingOptions =
        chatWindow.querySelectorAll(".options-container");

    existingOptions.forEach(options => {
        options.remove();
    });

}


function createOptionButton(text, callback, secondary = false) {

    const button = document.createElement("button");

    button.type = "button";

    button.className = secondary
        ? "option-button secondary"
        : "option-button";

    button.textContent = text;

    button.addEventListener("click", callback);

    return button;
}


/* =========================================================
   CATEGORY MENU
   ========================================================= */

function showCategories() {

    currentView = "categories";

    clearOptions();

    const container = document.createElement("div");

    container.className = "options-container";

    Object.entries(categories).forEach(([key, category]) => {

        const button = createOptionButton(
            category.title,
            () => selectCategory(key)
        );

        container.appendChild(button);

    });

    chatWindow.appendChild(container);

    scrollToBottom();
}


/* =========================================================
   CATEGORY SELECTION
   ========================================================= */

function selectCategory(categoryKey) {

    if (isProcessing) {
        return;
    }

    const category = categories[categoryKey];

    if (!category) {
        return;
    }

    currentView = categoryKey;

    clearOptions();

    addUserMessage(category.title);

    showTyping();

    isProcessing = true;

    setTimeout(() => {

        removeTyping();

        addBotMessage(
            `Here are the questions I can help you with under <strong>${category.title}</strong>:`
        );

        showQuestions(categoryKey);

        isProcessing = false;

    }, 450);

}


/* =========================================================
   QUESTIONS
   ========================================================= */

function showQuestions(categoryKey) {

    const category = categories[categoryKey];

    if (!category) {
        return;
    }

    clearOptions();

    const container = document.createElement("div");

    container.className = "options-container";

    category.questions.forEach(questionKey => {

        const knowledge = knowledgeBase[questionKey];

        if (!knowledge) {
            return;
        }

        const button = createOptionButton(
            knowledge.question,
            () => selectQuestion(questionKey)
        );

        container.appendChild(button);

    });


    const backButton = createOptionButton(
        "Back to Main Menu",
        () => goBackToCategories(),
        true
    );

    container.appendChild(backButton);

    chatWindow.appendChild(container);

    scrollToBottom();
}


/* =========================================================
   QUESTION SELECTION
   ========================================================= */

function selectQuestion(questionKey) {

    if (isProcessing) {
        return;
    }

    const knowledge = knowledgeBase[questionKey];

    if (!knowledge) {
        return;
    }

    clearOptions();

    addUserMessage(knowledge.question);

    showTyping();

    isProcessing = true;

    setTimeout(() => {

        removeTyping();

        addBotMessage(knowledge.answer);

        showAnswerActions();

        isProcessing = false;

    }, 600);

}


/* =========================================================
   AFTER ANSWER
   ========================================================= */

function showAnswerActions() {

    clearOptions();

    const container = document.createElement("div");

    container.className = "options-container";


    const category = categories[currentView];

    if (category) {

        const moreQuestionsButton = createOptionButton(
            "More Questions",
            () => showQuestions(currentView)
        );

        container.appendChild(moreQuestionsButton);

    }


    const mainMenuButton = createOptionButton(
        "Back to Main Menu",
        () => goBackToCategories(),
        true
    );

    container.appendChild(mainMenuButton);


    const contactButton = createOptionButton(
        "Contact SGO",
        () => selectQuestion("contact"),
        true
    );

    container.appendChild(contactButton);

    chatWindow.appendChild(container);

    scrollToBottom();
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function goBackToCategories() {

    if (isProcessing) {
        return;
    }

    clearOptions();

    addUserMessage("Back to Main Menu");

    showTyping();

    isProcessing = true;

    setTimeout(() => {

        removeTyping();

        addBotMessage(
            "What would you like help with?"
        );

        showCategories();

        isProcessing = false;

    }, 350);

}


/* =========================================================
   CLOSE CHAT
   ========================================================= */

function closeChat() {

    if (isProcessing) {
        return;
    }

    clearOptions();

    addUserMessage("Close");

    showTyping();

    isProcessing = true;

    setTimeout(() => {

        removeTyping();

        addBotMessage(
            "Thank you for using the SGO Assistant."
        );

        setTimeout(() => {

            window.location.href = "/dashboard.html";

        }, 1000);

    }, 400);

}


closeChatButton.addEventListener("click", closeChat);


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

    requestAnimationFrame(() => {

        chatWindow.scrollTop = chatWindow.scrollHeight;

    });

}


/* =========================================================
   INITIAL MESSAGE
   ========================================================= */

function initializeChat() {

    const userName = getUserName();

    addBotMessage(
        `Hello ${userName}. I’m the <strong>SGO Assistant</strong>.<br><br>
        I can help you with budget requests, required documents,
        request status, revisions and contacting the SGO.
        <br><br>
        What would you like help with?`
    );

    showCategories();

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeChat();

});