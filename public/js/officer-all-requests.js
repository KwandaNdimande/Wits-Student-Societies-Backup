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

// Check authentication
const userUid = localStorage.getItem('userUid');
const userRole = localStorage.getItem('userRole');
if (!userUid || userRole !== 'officer') {
    window.location.href = '/login.html';
}

let allRequests = [];
let filteredRequests = [];
let currentPage = 1;
const pageSize = 5;

let deletedRequests = [];
let filteredDeleted = [];
let deletedPage = 1;
const deletedPageSize = 5;

let currentTab = 'active';

// Status colors
const statusColors = {
    "Submitted": "status-submitted",
    "Under Review": "status-under-review",
    "Approved": "status-approved",
    "Rejected": "status-rejected",
    "Revision Required": "status-revision",
    "Resubmitted": "status-resubmitted",
    "Deleted": "status-deleted"
};

const statusOptions = ["Submitted", "Under Review", "Revision Required", "Approved", "Rejected"];

let pendingStatusUpdate = null;
let pendingReverseRequestId = null;
let pendingDeleteRequestId = null;

// ================================================================
// HELPER: Get timestamp in milliseconds from any format
// ================================================================
function getTimestampMs(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp === 'number') return timestamp;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp === 'string') return Date.parse(timestamp) || 0;
    if (timestamp.seconds) return timestamp.seconds * 1000 + Math.round((timestamp.nanoseconds || 0) / 1e6);
    return 0;
}

// ================================================================
// HELPER: Format timestamp to readable string
// ================================================================
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown time';
    const ms = getTimestampMs(timestamp);
    if (ms === 0) return 'Unknown time';
    return new Date(ms).toLocaleString();
}

// ================================================================
// TAB SWITCHING
// ================================================================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === 'tab-' + tab);
    });
    if (tab === 'deleted') {
        renderDeletedTable();
    }
}
window.switchTab = switchTab;

// ================================================================
// LOAD ACTIVE REQUESTS
// ================================================================
async function loadRequests() {
    try {
        const requestsSnapshot = await db.collection('requests')
            .orderBy('submittedAt', 'desc')
            .get();

        allRequests = [];
        requestsSnapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
        });

        filteredRequests = [...allRequests];
        currentPage = 1;
        renderTable();
        renderOfficerNotifications();
        openOfficerNotificationFromUrl();

    } catch (error) {
        console.error('Error loading requests:', error);
        document.getElementById('requests-container').innerHTML = '<p style="color:#dc3545;text-align:center;padding:40px;">Error loading requests. Please try again.</p>';
    }
}

// ================================================================
// LOAD DELETED REQUESTS
// ================================================================
async function loadDeletedRequests() {
    try {
        const snapshot = await db.collection('deletedRequests')
            .orderBy('deletedAt', 'desc')
            .get();

        deletedRequests = [];
        snapshot.forEach(doc => {
            deletedRequests.push({ id: doc.id, ...doc.data() });
        });

        filteredDeleted = [...deletedRequests];
        deletedPage = 1;
        if (currentTab === 'deleted') {
            renderDeletedTable();
        }
    } catch (error) {
        console.error('Error loading deleted requests:', error);
        document.getElementById('deleted-requests-container').innerHTML = '<p style="color:#dc3545;text-align:center;padding:40px;">Error loading deleted requests.</p>';
    }
}

// ================================================================
// SEARCH FUNCTION (Active)
// ================================================================
function searchRequests() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase().trim() || '';
    
    if (searchTerm === '') {
        filteredRequests = [...allRequests];
    } else {
        filteredRequests = allRequests.filter(r => 
            (r.societyName && r.societyName.toLowerCase().includes(searchTerm)) ||
            (r.itemName && r.itemName.toLowerCase().includes(searchTerm)) ||
            (r.type && r.type.toLowerCase().includes(searchTerm)) ||
            (r.status && r.status.toLowerCase().includes(searchTerm))
        );
    }
    
    currentPage = 1;
    renderTable();
}

// ================================================================
// RENDER ACTIVE TABLE
// ================================================================

function renderTable() {
    const container = document.getElementById('requests-container');
    const totalItems = filteredRequests.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = filteredRequests.slice(startIndex, endIndex);

    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = `Showing ${totalItems > 0 ? startIndex + 1 : 0}-${endIndex} of ${totalItems} requests`;
    }

    if (totalItems === 0) {
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">No active requests found.</div>
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Society</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Documents</th>
                        <th>Update Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pageItems.forEach((r, index) => {
        const num = startIndex + index + 1;
        const statusClass = statusColors[r.status] || 'status-submitted';
        const isLocked = r.status === 'Approved' || r.status === 'Rejected';
        const isRevisionLocked = r.status === 'Revision Required';
        const isResubmitted = r.status === 'Resubmitted';
        
        const optionValues = [...statusOptions];
        if (!optionValues.includes(r.status)) {
            optionValues.unshift(r.status);
        }
        const optionsHTML = optionValues.map(s => 
            `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`
        ).join('');

        const hasDocs = r.documents && Object.keys(r.documents).length > 0;
        const hasOfficerComment = r.status === 'Revision Required' && r.officerComment && r.officerComment !== '';

        let actionButtons = `
            <button class="btn-view" onclick="showRequestDetails('${r.id}')">View Details</button>
            <button class="btn-delete" onclick="openDeleteModal('${r.id}')">Delete</button>
        `;

        if (isLocked) {
            actionButtons = `
                <button class="btn-view" onclick="showRequestDetails('${r.id}')">View Details</button>
                <button class="btn-reverse" onclick="openReverseModal('${r.id}')">Reverse</button>
                <button class="btn-delete" onclick="openDeleteModal('${r.id}')">Delete</button>
            `;
        }

        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${num}</td>
                <td class="strong">${r.societyName || 'Unknown'}</td>
                <td style="color:#6c757d;">${r.type || 'N/A'}</td>
                <td>
                    <span class="status-badge ${statusClass}">${r.status || 'N/A'}</span>
                    ${hasOfficerComment ? `<br><span style="font-size:11px;color:#E65100;">${r.officerComment}</span>` : ''}
                </td>
                <td>
                    <button class="btn-view" onclick="viewDocuments('${r.id}')">
                        ${hasDocs ? 'View' : 'No Docs'}
                    </button>
                </td>
                <td>
                    ${isRevisionLocked ? 
                        `<span class="waiting-text">Awaiting Resubmission</span>` :
                        `<select class="status-select" onchange="prepareStatusChange('${r.id}', this.value)" ${isLocked ? 'disabled' : ''}>
                            ${optionsHTML}
                        </select>`
                    }
                    ${isResubmitted ? `<button class="btn-view" onclick="viewUpdatedDocuments('${r.id}')">Compare</button>` : ''}
                </td>
                <td>
                    ${actionButtons}
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div class="pagination">
                <span class="info">Showing ${startIndex + 1}-${endIndex} of ${totalItems} requests</span>
                <div class="pages">
                    <button onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>
    `;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) html += `<span class="ellipsis">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="ellipsis">…</span>`;
        html += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    html += `
                    <button onclick="changePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
}

// ================================================================
// RENDER DELETED TABLE
// ================================================================

function renderDeletedTable() {
    const container = document.getElementById('deleted-requests-container');
    const totalItems = filteredDeleted.length;
    const totalPages = Math.ceil(totalItems / deletedPageSize) || 1;
    
    if (deletedPage > totalPages) deletedPage = totalPages;
    
    const startIndex = (deletedPage - 1) * deletedPageSize;
    const endIndex = Math.min(startIndex + deletedPageSize, totalItems);
    const pageItems = filteredDeleted.slice(startIndex, endIndex);

    if (totalItems === 0) {
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">No deleted requests found.</div>
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Society</th>
                        <th>Request</th>
                        <th>Type</th>
                        <th>Deleted By</th>
                        <th>Deleted At</th>
                        <th>Reason</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pageItems.forEach((r, index) => {
        const num = startIndex + index + 1;
        const originalStatus = r.originalData?.status || 'Unknown';

        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${num}</td>
                <td class="strong">${r.societyName || 'Unknown'}</td>
                <td>${r.requestName || r.originalData?.itemName || 'Untitled'}</td>
                <td style="color:#6c757d;">${r.originalData?.type || 'N/A'}</td>
                <td>${r.deletedBy || 'Unknown'}</td>
                <td style="color:#6c757d;">${formatTimestamp(r.deletedAt)}</td>
                <td style="color:#6c757d;max-width:200px;word-wrap:break-word;">${r.reason || 'No reason provided'}</td>
                <td>
                    <button class="btn-view" onclick="viewDeletedRequestDetails('${r.id}')">View</button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div class="pagination">
                <span class="info">Showing ${startIndex + 1}-${endIndex} of ${totalItems} deleted requests</span>
                <div class="pages">
                    <button onclick="changeDeletedPage(${deletedPage - 1})" ${deletedPage <= 1 ? 'disabled' : ''}>‹</button>
    `;

    const maxVisible = 5;
    let startPage = Math.max(1, deletedPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="changeDeletedPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="ellipsis">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === deletedPage ? 'active' : ''}" onclick="changeDeletedPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="ellipsis">…</span>`;
        html += `<button onclick="changeDeletedPage(${totalPages})">${totalPages}</button>`;
    }

    html += `
                    <button onclick="changeDeletedPage(${deletedPage + 1})" ${deletedPage >= totalPages ? 'disabled' : ''}>›</button>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function changeDeletedPage(page) {
    const totalPages = Math.ceil(filteredDeleted.length / deletedPageSize) || 1;
    if (page < 1 || page > totalPages) return;
    deletedPage = page;
    renderDeletedTable();
}

// ================================================================
// VIEW DELETED REQUEST DETAILS
// ================================================================

function viewDeletedRequestDetails(deletedId) {
    const request = deletedRequests.find(r => r.id === deletedId);
    if (!request) {
        alert('Deleted request not found.');
        return;
    }

    const data = request.originalData || {};
    const itemName = request.requestName || data.itemName || 'Untitled Request';
    const society = request.societyName || 'Unknown Society';
    const status = data.status || 'N/A';
    const type = data.type || 'N/A';
    const amount = data.amount ? `R${data.amount.toLocaleString()}` : 'N/A';
    const submittedAt = data.submittedAt ? new Date(data.submittedAt.seconds * 1000).toLocaleString() : 'N/A';
    const description = data.description || 'No description provided.';

    const modalBody = `
        <div style="margin-bottom:16px;">
            <div style="font-size:14px;color:var(--text-500);margin-bottom:4px;">${society}</div>
            <div style="font-size:20px;font-weight:700;color:var(--navy-900);">${itemName}</div>
            <div style="margin-top:8px;">
                <span class="status-badge status-deleted">Deleted</span>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div><strong>Request Type</strong><div style="margin-top:4px;color:var(--text-600);">${type}</div></div>
            <div><strong>Amount</strong><div style="margin-top:4px;color:var(--text-600);">${amount}</div></div>
            <div><strong>Submitted</strong><div style="margin-top:4px;color:var(--text-600);">${submittedAt}</div></div>
            <div><strong>Deleted By</strong><div style="margin-top:4px;color:var(--text-600);">${request.deletedBy || 'Unknown'}</div></div>
            <div><strong>Deleted At</strong><div style="margin-top:4px;color:var(--text-600);">${formatTimestamp(request.deletedAt)}</div></div>
            <div><strong>Deletion Reason</strong><div style="margin-top:4px;color:var(--text-600);">${request.reason || 'No reason provided'}</div></div>
        </div>
        <div style="margin-bottom:16px;">
            <strong>Description</strong>
            <div style="margin-top:4px;color:var(--text-600);">${description}</div>
        </div>
    `;

    document.getElementById('modalTitle').textContent = `Deleted Request - ${itemName}`;
    document.getElementById('modalBody').innerHTML = modalBody;
    document.getElementById('docModal').classList.add('active');
}

// ================================================================
// NOTIFICATION FUNCTIONS
// ================================================================

function initOfficerNotificationBell() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks || navLinks.querySelector('.nav-bell')) return;

    const bell = document.createElement('div');
    bell.className = 'nav-bell';
    bell.innerHTML = `
        <button id="officerNotificationBell" class="nav-bell-btn" type="button" aria-haspopup="true" aria-expanded="false">
            🔔 <span id="officerNotificationCount" class="notification-badge hidden">0</span>
        </button>
        <div id="officerNotificationDropdown" class="notification-dropdown" style="left: 0; right: auto;"></div>
    `;
    navLinks.prepend(bell);

    document.getElementById('officerNotificationBell').addEventListener('click', function(event) {
        event.stopPropagation();
        toggleOfficerDropdown();
    });

    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('officerNotificationDropdown');
        const bell = document.getElementById('officerNotificationBell');
        if (!dropdown || !dropdown.classList.contains('active')) return;
        if (bell.contains(event.target) || dropdown.contains(event.target)) return;
        closeOfficerDropdown();
    });
}

function renderOfficerNotifications() {
    initOfficerNotificationBell();

    const lastSeen = parseInt(localStorage.getItem('officerNotificationsLastSeen') || '0', 10);
    const events = [];

    allRequests.forEach(request => {
        const submittedAt = getTimestampMs(request.submittedAt);
        if (submittedAt > lastSeen) {
            events.push({ request, ts: submittedAt });
        }
    });

    events.sort((a,b) => b.ts - a.ts);

    const badge = document.getElementById('officerNotificationCount');
    if (badge) {
        if (events.length > 0) {
            badge.textContent = events.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    const dropdown = document.getElementById('officerNotificationDropdown');
    if (!dropdown) return;

    if (events.length === 0) {
        dropdown.innerHTML = '<div class="notification-item empty">No new submissions.</div>';
        return;
    }

    dropdown.innerHTML = events.slice(0, 5).map(item => {
        const request = item.request;
        const when = new Date(item.ts).toLocaleString();
        const title = request.itemName || request.name || 'New Request';
        return `
            <div class="notification-item" onclick="openOfficerNotification('${request.id}')">
                <div class="title">${title}</div>
                <div class="meta">${request.societyName || 'Leader'} · ${when}</div>
                <div class="note">New submission received.</div>
            </div>
        `;
    }).join('');
}

function toggleOfficerDropdown() {
    const dropdown = document.getElementById('officerNotificationDropdown');
    if (!dropdown) return;
    const isActive = dropdown.classList.toggle('active');
    if (isActive) {
        localStorage.setItem('officerNotificationsLastSeen', Date.now().toString());
        renderOfficerNotifications();
    }
}

function closeOfficerDropdown() {
    const dropdown = document.getElementById('officerNotificationDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

function openOfficerNotification(requestId) {
    closeOfficerDropdown();
    showRequestDetails(requestId);
}

function openOfficerNotificationFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('openRequest');
    if (requestId) {
        showRequestDetails(requestId);
    }
}

// ================================================================
// VIEW / DOWNLOAD FILE FUNCTIONS
// ================================================================

async function viewFileFromSupabase(filePath, fileName) {
    try {
        const { data } = window.supabaseClient.storage
            .from('documents')
            .getPublicUrl(filePath);

        if (data && data.publicUrl) {
            window.open(data.publicUrl, '_blank');
        } else {
            alert('Failed to generate view link.');
        }
    } catch (error) {
        console.error('View error:', error);
        alert('An unexpected error occurred: ' + error.message);
    }
}

async function downloadFileFromSupabase(filePath, fileName) {
    try {
        const { data } = window.supabaseClient.storage
            .from('documents')
            .getPublicUrl(filePath);

        if (data && data.publicUrl) {
            const a = document.createElement('a');
            a.href = data.publicUrl;
            a.download = fileName || filePath.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('Failed to generate download link.');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('An unexpected error occurred while downloading: ' + error.message);
    }
}

function getFileInfo(doc) {
    if (!doc) return { path: null, name: null };
    if (typeof doc === 'string') {
        return { path: doc, name: doc.split('/').pop() };
    }
    if (doc.filePath) {
        return { path: doc.filePath, name: doc.filePath.split('/').pop() };
    }
    if (doc.path) {
        return { path: doc.path, name: doc.path.split('/').pop() };
    }
    if (doc.fileName) {
        return { path: doc.filePath || null, name: doc.fileName };
    }
    if (doc.name) {
        return { path: doc.filePath || null, name: doc.name };
    }
    return { path: null, name: null };
}

// ================================================================
// VIEW DOCUMENTS
// ================================================================

async function viewDocuments(requestId) {
    try {
        const docRef = await db.collection('requests').doc(requestId).get();
        if (!docRef.exists) {
            showModal('Request not found', '<p>No documents found for this request.</p>');
            return;
        }

        const data = docRef.data();
        const documents = data.documents || {};
        const itemName = data.itemName || 'Request';

        let modalBody = '';

        if (Object.keys(documents).length === 0) {
            modalBody = '<p class="no-docs">No documents uploaded for this request.</p>';
        } else {
            const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
            const docLabels = {
                'budgetForm': 'Budget Form',
                'meetingMinutes': 'Meeting Minutes',
                'vendorQuotation': 'Vendor Quotation'
            };

            modalBody = docOrder.map(key => {
                const doc = documents[key];
                if (!doc) {
                    return `
                        <div class="doc-item">
                            <div class="doc-name">${docLabels[key] || key}</div>
                            <div class="doc-detail">No file uploaded</div>
                        </div>
                    `;
                }
                const info = getFileInfo(doc);
                if (!info.path) {
                    return `
                        <div class="doc-item">
                            <div class="doc-name">${docLabels[key] || key}</div>
                            <div class="doc-detail">${info.name || 'File not found'}</div>
                        </div>
                    `;
                }
                return `
                    <div class="doc-item">
                        <div class="doc-name">${docLabels[key] || key}</div>
                        <div class="doc-detail">${info.name}</div>
                        <div style="display:flex; gap:8px; margin-left:auto; flex-wrap:wrap;">
                            <button class="btn-view-doc" onclick="viewFileFromSupabase('${info.path}', '${info.name}')">View</button>
                            <button class="btn-download" onclick="downloadFileFromSupabase('${info.path}', '${info.name}')">Download</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        showModal(`Documents - ${itemName}`, modalBody);
    } catch (error) {
        console.error('Error viewing documents:', error);
        alert('Error loading documents. ' + error.message);
    }
}

async function viewUpdatedDocuments(requestId) {
    try {
        const docRef = await db.collection('requests').doc(requestId).get();
        if (!docRef.exists) {
            showModal('Request not found', '<p>No documents found for this request.</p>');
            return;
        }

        const data = docRef.data();
        const documents = data.documents || {};
        const itemName = data.itemName || 'Request';
        const officerComment = data.officerComment || '';
        const leaderComment = data.leaderComment || '';

        let modalBody = `
            <div style="margin-bottom:16px;padding:12px;background:#FFF3E0;border-radius:8px;">
                <strong style="color:#E65100;">Revision Requested:</strong>
                <p style="color:#5A6B87;font-size:14px;margin:4px 0 0;">${officerComment || 'No comment provided'}</p>
            </div>
        `;

        if (leaderComment) {
            modalBody += `
                <div style="margin-bottom:16px;padding:12px;background:#E3F2FD;border-radius:8px;">
                    <strong style="color:#0D47A1;">Leader's Note:</strong>
                    <p style="color:#5A6B87;font-size:14px;margin:4px 0 0;">${leaderComment}</p>
                </div>
            `;
        }

        if (Object.keys(documents).length === 0) {
            modalBody += '<p class="no-docs">No documents uploaded for this request.</p>';
        } else {
            const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
            const docLabels = {
                'budgetForm': 'Budget Form',
                'meetingMinutes': 'Meeting Minutes',
                'vendorQuotation': 'Vendor Quotation'
            };

            modalBody += '<h3 style="margin-top:12px;font-size:16px;color:var(--navy-900);">Updated Documents</h3>';
            
            modalBody += docOrder.map(key => {
                const doc = documents[key];
                if (!doc) {
                    return `
                        <div class="doc-item">
                            <div class="doc-name">${docLabels[key] || key}</div>
                            <div class="doc-detail">No file uploaded</div>
                        </div>
                    `;
                }
                const info = getFileInfo(doc);
                if (!info.path) {
                    return `
                        <div class="doc-item">
                            <div class="doc-name">${docLabels[key] || key}</div>
                            <div class="doc-detail">${info.name || 'File not found'}</div>
                        </div>
                    `;
                }
                return `
                    <div class="doc-item">
                        <div class="doc-name">${docLabels[key] || key}</div>
                        <div class="doc-detail">${info.name}</div>
                        <div style="display:flex; gap:8px; margin-left:auto; flex-wrap:wrap;">
                            <button class="btn-view-doc" onclick="viewFileFromSupabase('${info.path}', '${info.name}')">View</button>
                            <button class="btn-download" onclick="downloadFileFromSupabase('${info.path}', '${info.name}')">Download</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        showModal(`Updated Documents - ${itemName}`, modalBody);
    } catch (error) {
        console.error('Error viewing updated documents:', error);
        alert('Error loading documents. ' + error.message);
    }
}

// ================================================================
// REQUEST DETAIL VIEW
// ================================================================

function showRequestDetails(requestId) {
    return viewRequestDetails(requestId);
}

async function viewRequestDetails(requestId) {
    try {
        const docRef = await db.collection('requests').doc(requestId).get();
        if (!docRef.exists) {
            showModal('Request not found', '<p>No details found for this request.</p>');
            return;
        }

        const data = docRef.data();
        const itemName = data.itemName || data.name || 'Untitled Request';
        const society = data.societyName || 'Unknown Society';
        const status = data.status || 'N/A';
        const type = data.type || 'N/A';
        const amount = data.amount ? `R${data.amount.toLocaleString()}` : 'N/A';
        const submittedAt = data.submittedAt ? new Date(data.submittedAt.seconds * 1000).toLocaleString() : 'N/A';
        const description = data.description || 'No description provided.';
        const documents = data.documents || {};
        const officerComment = data.officerComment || '';
        const leaderComment = data.leaderComment || '';
        const history = data.statusHistory || [];

        // Build documents HTML
        const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
        const docLabels = {
            'budgetForm': 'Budget Form',
            'meetingMinutes': 'Meeting Minutes',
            'vendorQuotation': 'Vendor Quotation'
        };

        let docsHtml = docOrder.map(key => {
            const doc = documents[key];
            if (!doc) {
                return `
                    <div class="doc-item">
                        <span class="doc-name">${docLabels[key] || key}</span>
                        <span class="doc-detail">No file uploaded</span>
                    </div>
                `;
            }
            const info = getFileInfo(doc);
            if (!info.path) {
                return `
                    <div class="doc-item">
                        <span class="doc-name">${docLabels[key] || key}</span>
                        <span class="doc-detail">${info.name || 'File not found'}</span>
                    </div>
                `;
            }
            return `
                <div class="doc-item">
                    <span class="doc-name">${docLabels[key] || key}</span>
                    <span class="doc-detail">${info.name}</span>
                    <div style="display:flex; gap:8px; margin-left:auto; flex-wrap:wrap;">
                        <button class="btn-view-doc" onclick="viewFileFromSupabase('${info.path}', '${info.name}')">View</button>
                        <button class="btn-download" onclick="downloadFileFromSupabase('${info.path}', '${info.name}')">Download</button>
                    </div>
                </div>
            `;
        }).join('');

        const detailRows = `
            <div class="detail-row"><span class="detail-label">Request Type</span><span class="detail-value">${type}</span></div>
            <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">${amount}</span></div>
            <div class="detail-row"><span class="detail-label">Submitted</span><span class="detail-value">${submittedAt}</span></div>
            <div class="detail-row"><span class="detail-label">Description</span><span class="detail-value">${description}</span></div>
        `;

        const officerCommentHtml = officerComment ? `
            <div class="detail-row" style="background:#FFF3E0;padding:8px 12px;border-radius:6px;margin-bottom:12px;border-left:4px solid #E65100;">
                <span class="detail-label" style="font-weight:600;color:#E65100;">Officer Feedback</span>
                <span class="detail-value">${officerComment}</span>
            </div>
        ` : '';

        const leaderCommentHtml = leaderComment ? `
            <div class="detail-row" style="background:#E3F2FD;padding:8px 12px;border-radius:6px;margin-bottom:12px;border-left:4px solid #0D47A1;">
                <span class="detail-label" style="font-weight:600;color:#0D47A1;">Leader's Note</span>
                <span class="detail-value">${leaderComment}</span>
            </div>
        ` : '';

        const historyHtml = getRequestHistoryHtml(history);

        const modalBody = `
            <div style="margin-bottom:16px;">
                <div style="font-size:14px;color:var(--text-500);margin-bottom:4px;">${society}</div>
                <div style="font-size:20px;font-weight:700;color:var(--navy-900);">${itemName}</div>
                <div style="margin-top:8px;">
                    <span class="status-badge ${statusColors[status] || 'status-submitted'}">${status}</span>
                </div>
            </div>
            <div style="margin-bottom:16px;">
                ${detailRows}
            </div>
            ${officerCommentHtml}
            ${leaderCommentHtml}
            <div style="margin-bottom:16px;">
                <h3 style="font-size:15px;color:var(--navy-900);margin-bottom:10px;">Documents</h3>
                ${docsHtml}
            </div>
            ${historyHtml}
        `;

        document.getElementById('modalTitle').textContent = `Request Details - ${itemName}`;
        document.getElementById('modalBody').innerHTML = modalBody;
        document.getElementById('docModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing request details:', error);
        alert('Error loading request details. ' + error.message);
    }
}

// ================================================================
// ACTIVITY TIMELINE
// ================================================================

function getRequestHistoryHtml(history = []) {
    if (!Array.isArray(history) || history.length === 0) {
        return `<div style="margin-top:16px;padding:16px 0;color:var(--text-500);font-size:13px;">No activity history yet.</div>`;
    }

    const sortedHistory = [...history].sort((a, b) => {
        const aTime = getTimestampMs(a.timestamp);
        const bTime = getTimestampMs(b.timestamp);
        return bTime - aTime;
    });

    return `
        <div style="margin-top:16px;">
            <h3 style="font-size:15px;color:var(--navy-900);margin-bottom:12px;">Activity Timeline</h3>
            ${sortedHistory.map(entry => {
                const when = formatTimestamp(entry.timestamp);
                let statusLabel = entry.status || 'Status changed';
                if (entry.isReversal) {
                    statusLabel = `Reversed to ${entry.status}`;
                }
                if (entry.isDeletion) {
                    statusLabel = 'Request deleted';
                }
                return `
                    <div style="padding:14px 16px;border:1px solid var(--border);border-radius:12px;margin-bottom:12px;background:#FAFBFD;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                            <span style="font-weight:600;color:var(--text-900);">${statusLabel}</span>
                            <span style="font-size:12px;color:var(--text-500);">${when}</span>
                        </div>
                        <div style="margin-top:8px;font-size:13px;color:var(--text-600);">
                            ${entry.actorName || 'Officer'} · ${entry.actorRole || 'officer'}
                        </div>
                        ${entry.note ? `<div style="margin-top:8px;font-size:13px;color:var(--text-600);">${entry.note}</div>` : ''}
                        ${entry.isReversal ? `<div style="margin-top:8px;font-size:12px;color:#E65100;font-style:italic;">Reversal reason: ${entry.note || 'No reason provided'}</div>` : ''}
                        ${entry.isDeletion ? `<div style="margin-top:8px;font-size:12px;color:#E65100;font-style:italic;">Deletion reason: ${entry.note || 'No reason provided'}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ================================================================
// REVERSE DECISION FUNCTIONS
// ================================================================

function openReverseModal(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        alert('Request not found.');
        return;
    }

    pendingReverseRequestId = requestId;

    const newStatus = 'Under Review';
    const statusClass = statusColors[request.status] || 'status-submitted';
    const infoHtml = `
        <div class="info-row">
            <span class="label">Society</span>
            <span class="value">${request.societyName || 'Unknown'}</span>
        </div>
        <div class="info-row">
            <span class="label">Request</span>
            <span class="value">${request.itemName || request.name || 'Untitled'}</span>
        </div>
        <div class="info-row">
            <span class="label">Current Status</span>
            <span class="value"><span class="status-badge ${statusClass}">${request.status || 'N/A'}</span></span>
        </div>
        <div class="info-row">
            <span class="label">New Status</span>
            <span class="value"><span class="status-badge status-under-review">${newStatus}</span></span>
        </div>
    `;

    document.getElementById('reverseRequestInfo').innerHTML = infoHtml;
    document.getElementById('reverseReason').value = '';
    document.getElementById('reverseModal').classList.add('active');
    document.getElementById('reverseReason').focus();
}

function closeReverseModal() {
    document.getElementById('reverseModal').classList.remove('active');
    pendingReverseRequestId = null;
}

function confirmReverse() {
    if (!pendingReverseRequestId) return;

    const reason = document.getElementById('reverseReason').value.trim();
    if (!reason) {
        alert('Please provide a reason for the reversal.');
        document.getElementById('reverseReason').focus();
        return;
    }

    const request = allRequests.find(r => r.id === pendingReverseRequestId);
    if (!request) {
        alert('Request not found.');
        closeReverseModal();
        return;
    }

    const newStatus = 'Under Review';
    const btn = document.getElementById('confirmReverseBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const originalStatus = request.status;
    const actorName = localStorage.getItem('userName') || 'Officer';
    const actorRole = localStorage.getItem('userRole') || 'officer';

    const historyEntry = {
        timestamp: new Date().toISOString(),
        status: newStatus,
        actorName: actorName,
        actorRole: actorRole,
        note: `Reversal from ${originalStatus}: ${reason}`,
        isReversal: true,
        reversedFrom: originalStatus,
        reversalReason: reason
    };

    db.collection('requests').doc(pendingReverseRequestId).update({
        status: newStatus,
        officerComment: `Reversed from ${originalStatus} - ${reason}`,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        statusHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry)
    })
    .then(() => {
        db.collection('reversalLogs').add({
            requestId: pendingReverseRequestId,
            requestName: request.itemName || request.name || 'Untitled',
            societyName: request.societyName || 'Unknown',
            reversedFrom: originalStatus,
            reversedTo: newStatus,
            reason: reason,
            officerName: actorName,
            officerUid: userUid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .catch(err => console.warn('Audit log error:', err));

        if (request.submittedBy) {
            db.collection('users').doc(request.submittedBy).get()
                .then(userDoc => {
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        if (userData.email) {
                            fetch('/api/send-status-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: userData.email,
                                    requestName: request.itemName || request.name || 'Your Request',
                                    status: newStatus,
                                    officerComment: `Your request has been reversed from "${originalStatus}" to "Under Review". Reason: ${reason}`
                                })
                            })
                            .then(res => {
                                if (!res.ok) console.warn('Email notification failed.');
                            })
                            .catch(err => console.warn('Email error:', err));
                        }
                    }
                })
                .catch(err => console.warn('Failed to fetch leader email:', err));
        }

        closeReverseModal();
        loadRequests();
        alert(`Request has been reversed from "${originalStatus}" to "Under Review". The leader has been notified.`);
    })
    .catch(error => {
        console.error('Error reversing request:', error);
        alert('Error reversing request: ' + error.message);
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Confirm Reversal';
    });
}

// ================================================================
// DELETE FUNCTIONS
// ================================================================

function openDeleteModal(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        alert('Request not found.');
        return;
    }

    pendingDeleteRequestId = requestId;

    const statusClass = statusColors[request.status] || 'status-submitted';
    const infoHtml = `
        <div class="info-row">
            <span class="label">Society</span>
            <span class="value">${request.societyName || 'Unknown'}</span>
        </div>
        <div class="info-row">
            <span class="label">Request</span>
            <span class="value">${request.itemName || request.name || 'Untitled'}</span>
        </div>
        <div class="info-row">
            <span class="label">Status</span>
            <span class="value"><span class="status-badge ${statusClass}">${request.status || 'N/A'}</span></span>
        </div>
    `;

    document.getElementById('deleteRequestInfo').innerHTML = infoHtml;
    document.getElementById('deleteReason').value = '';
    document.getElementById('deleteModal').classList.add('active');
    document.getElementById('deleteReason').focus();
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    pendingDeleteRequestId = null;
}

function confirmDelete() {
    if (!pendingDeleteRequestId) return;

    const reason = document.getElementById('deleteReason').value.trim();
    if (!reason) {
        alert('Please provide a reason for the deletion.');
        document.getElementById('deleteReason').focus();
        return;
    }

    const request = allRequests.find(r => r.id === pendingDeleteRequestId);
    if (!request) {
        alert('Request not found.');
        closeDeleteModal();
        return;
    }

    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const actorName = localStorage.getItem('userName') || 'Officer';
    const actorRole = localStorage.getItem('userRole') || 'officer';

    // Create a copy of the request data for the audit log
    const requestData = { ...request };
    delete requestData.id; // Remove the ID as it will be stored separately

    // Create deletion log entry
    const deletionEntry = {
        requestId: pendingDeleteRequestId,
        requestName: request.itemName || request.name || 'Untitled',
        societyName: request.societyName || 'Unknown',
        originalData: requestData,
        deletedBy: actorName,
        deletedByUid: userUid,
        reason: reason,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Add to deletedRequests collection
    db.collection('deletedRequests').add(deletionEntry)
    .then(() => {
        // Add deletion entry to the original request's history before deleting
        const historyEntry = {
            timestamp: new Date().toISOString(),
            status: 'Deleted',
            actorName: actorName,
            actorRole: actorRole,
            note: `Deleted: ${reason}`,
            isDeletion: true,
            deletionReason: reason
        };

        // Update the original request to mark it as deleted in history, then delete it
        return db.collection('requests').doc(pendingDeleteRequestId).update({
            statusHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry)
        })
        .then(() => {
            return db.collection('requests').doc(pendingDeleteRequestId).delete();
        });
    })
    .then(() => {
        closeDeleteModal();
        loadRequests();
        loadDeletedRequests();
        alert('Request deleted successfully. Audit log has been created.');
    })
    .catch(error => {
        console.error('Error deleting request:', error);
        alert('Error deleting request: ' + error.message);
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Confirm Delete';
    });
}

// ================================================================
// STATUS UPDATE FUNCTIONS
// ================================================================

function prepareStatusChange(requestId, newStatus) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    if (request.status === 'Approved' || request.status === 'Rejected') {
        alert('This request is locked and cannot be changed. Use the Reverse button instead.');
        renderTable();
        return;
    }
    if (request.status === 'Revision Required') {
        alert('This request is awaiting leader resubmission and cannot be changed.');
        renderTable();
        return;
    }
    if (newStatus === request.status) {
        return;
    }

    pendingStatusUpdate = {
        requestId,
        previousStatus: request.status,
        newStatus,
        requestData: request
    };

    openStatusModal(request);
}

function openStatusModal(request) {
    const modal = document.getElementById('statusModal');
    const title = document.getElementById('statusModalTitle');
    const body = document.getElementById('statusModalBody');
    const newStatus = pendingStatusUpdate?.newStatus;

    title.textContent = `Update status to ${newStatus}`;

    let bodyHtml = `
        <p style="font-size:14px;color:var(--text-600);margin-bottom:16px;">
            Changing status from <strong>${pendingStatusUpdate.previousStatus}</strong> to <strong>${newStatus}</strong>.
        </p>
    `;

    if (newStatus === 'Rejected') {
        bodyHtml += `
            <label for="statusRejectReason">Select rejection reason</label>
            <select id="statusRejectReason" class="status-select">
                <option value="">Choose a reason</option>
                <option value="Budget not approved">Budget not approved</option>
                <option value="Missing documentation">Missing documentation</option>
                <option value="Does not meet criteria">Does not meet criteria</option>
                <option value="Other">Other</option>
            </select>
            <div id="rejectCustomReasonWrapper" style="display:none;margin-top:12px;">
                <label for="statusRejectCustom">Custom rejection reason</label>
                <textarea id="statusRejectCustom" placeholder="Explain the reason for rejection..."></textarea>
            </div>
        `;
    } else if (newStatus === 'Revision Required') {
        bodyHtml += `
            <label for="statusReasonDetails">Revision note</label>
            <textarea id="statusReasonDetails" placeholder="Explain what needs to be revised..."></textarea>
        `;
    } else {
        bodyHtml += `
            <label for="statusReasonDetails">Optional note</label>
            <textarea id="statusReasonDetails" placeholder="Add a note for the record..."></textarea>
        `;
    }

    body.innerHTML = bodyHtml;
    modal.classList.add('active');

    const rejectReasonSelect = document.getElementById('statusRejectReason');
    if (rejectReasonSelect) {
        rejectReasonSelect.addEventListener('change', function() {
            const customWrapper = document.getElementById('rejectCustomReasonWrapper');
            customWrapper.style.display = this.value === 'Other' ? 'block' : 'none';
        });
    }
}

function closeStatusModal(resetSelect = false) {
    document.getElementById('statusModal').classList.remove('active');
    if (resetSelect && pendingStatusUpdate) {
        renderTable();
    }
    pendingStatusUpdate = null;
}

async function submitStatusModal() {
    if (!pendingStatusUpdate) return;

    const { requestId, newStatus } = pendingStatusUpdate;
    const noteTextarea = document.getElementById('statusReasonDetails');
    const noteText = noteTextarea ? noteTextarea.value.trim() : '';
    let statusNote = noteText;

    if (newStatus === 'Rejected') {
        const selectedReason = document.getElementById('statusRejectReason')?.value || '';
        const customReason = document.getElementById('statusRejectCustom')?.value.trim() || '';
        if (!selectedReason) {
            alert('Please choose a reason for rejection.');
            return;
        }
        if (selectedReason === 'Other') {
            if (!customReason) {
                alert('Please enter a custom reason.');
                return;
            }
            statusNote = customReason;
        } else {
            statusNote = selectedReason;
        }
    }

    if (newStatus === 'Revision Required' && !statusNote) {
        statusNote = 'Revision required';
    }

    const saveBtn = document.querySelector('#statusModal .btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : 'Save Status';
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        saveBtn.style.opacity = '0.7';
        saveBtn.style.cursor = 'not-allowed';
    }

    try {
        const actorName = localStorage.getItem('userName') || 'Officer';
        const actorRole = localStorage.getItem('userRole') || 'officer';

        const historyEntry = {
            timestamp: new Date().toISOString(),
            status: newStatus,
            actorName,
            actorRole,
            note: statusNote || ''
        };

        await db.collection('requests').doc(requestId).update({
            status: newStatus,
            officerComment: newStatus === 'Revision Required' || newStatus === 'Rejected' ? statusNote : (newStatus === 'Under Review' ? statusNote : ''),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry)
        });

        const requestDoc = await db.collection('requests').doc(requestId).get();
        const requestData = requestDoc.data();

        if (requestData?.submittedBy) {
            try {
                const userDoc = await db.collection('users').doc(requestData.submittedBy).get();
                const userData = userDoc.data();
                
                if (userData?.email) {
                    await fetch('/api/send-status-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userData.email,
                            requestName: requestData.itemName || 'Your Request',
                            status: newStatus,
                            officerComment: statusNote || ''
                        })
                    });
                }
            } catch (emailError) {
                console.error('Email error:', emailError);
            }
        }

        closeStatusModal(false);
        loadRequests();
        alert('Status updated successfully.');
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status. ' + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
        }
    }
}

// ================================================================
// MODAL FUNCTIONS
// ================================================================

function showModal(title, bodyHTML) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('docModal').classList.add('active');
}

function closeModal() {
    document.getElementById('docModal').classList.remove('active');
}

document.getElementById('docModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

document.getElementById('reverseModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeReverseModal();
    }
});

document.getElementById('deleteModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeDeleteModal();
    }
});

// ================================================================
// LOAD DATA
// ================================================================

loadRequests();
loadDeletedRequests();

window.searchRequests = searchRequests;