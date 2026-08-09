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

// Status colors
const statusColors = {
    "Submitted": "status-submitted",
    "Under Review": "status-under-review",
    "Approved": "status-approved",
    "Rejected": "status-rejected",
    "Revision Required": "status-revision",
    "Resubmitted": "status-resubmitted"
};

const statusOptions = ["Submitted", "Under Review", "Revision Required", "Approved", "Rejected"];

let pendingStatusUpdate = null;

// Load all requests
function getTimestampMs(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp === 'number') return timestamp;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (timestamp.seconds) return timestamp.seconds * 1000 + Math.round((timestamp.nanoseconds || 0) / 1e6);
    return Date.parse(timestamp) || 0;
}

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

// Search function
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

// Render table with pagination
function renderTable() {
    const container = document.getElementById('requests-container');
    const totalItems = filteredRequests.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = filteredRequests.slice(startIndex, endIndex);

    // Update results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = `Showing ${totalItems > 0 ? startIndex + 1 : 0}-${endIndex} of ${totalItems} requests`;
    }

    if (totalItems === 0) {
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">No requests found.</div>
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
                        <th>Amount</th>
                        <th>Date</th>
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

        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${num}</td>
                <td class="strong">${r.societyName || 'Unknown'}</td>
                <td>${r.itemName || r.name || 'Untitled'}</td>
                <td style="color:#6c757d;">${r.type || 'N/A'}</td>
                <td>R${r.amount ? r.amount.toLocaleString() : '0'}</td>
                <td style="color:#6c757d;">${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <span class="status-badge ${statusClass}">${r.status || 'N/A'}</span>
                    ${hasOfficerComment ? `<br><span style="font-size:11px;color:#E65100;">📝 ${r.officerComment}</span>` : ''}
                </td>
                <td>
                    <button class="btn-view" onclick="viewDocuments('${r.id}')">
                        ${hasDocs ? '📄 View' : 'No Docs'}
                    </button>
                </td>
                <td>
                    ${isRevisionLocked ? 
                        `<span class="waiting-text">⏳ Awaiting Resubmission</span>` :
                        `<select class="status-select" onchange="prepareStatusChange('${r.id}', this.value)" ${isLocked ? 'disabled' : ''}>
                            ${optionsHTML}
                        </select>`
                    }
                    ${isResubmitted ? `<button class="btn-view" onclick="viewUpdatedDocuments('${r.id}')">📂 Compare</button>` : ''}
                </td>
                <td>
                    <button class="btn-view" onclick="showRequestDetails('${r.id}')">View Details</button>
                    <button class="btn-delete" onclick="deleteRequest('${r.id}')">Delete</button>
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

function initOfficerNotificationBell() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks || navLinks.querySelector('.nav-bell')) return;

    const bell = document.createElement('div');
    bell.className = 'nav-bell';
    bell.innerHTML = `
        <button id="officerNotificationBell" class="nav-bell-btn" type="button" aria-haspopup="true" aria-expanded="false">
            🔔 <span id="officerNotificationCount" class="notification-badge hidden">0</span>
        </button>
        <div id="officerNotificationDropdown" class="notification-dropdown"></div>
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

// ============ VIEW DOCUMENTS ============
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
                const fileName = doc.fileName || 'No file';
                return `
                    <div class="doc-item">
                        <div class="doc-name">${docLabels[key] || key}</div>
                        <div class="doc-detail">${fileName}</div>
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

// ============ VIEW UPDATED DOCUMENTS (COMPARE) ============

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
                <strong style="color:#E65100;">📝 Revision Requested:</strong>
                <p style="color:#5A6B87;font-size:14px;margin:4px 0 0;">${officerComment || 'No comment provided'}</p>
            </div>
        `;

        if (leaderComment) {
            modalBody += `
                <div style="margin-bottom:16px;padding:12px;background:#E3F2FD;border-radius:8px;">
                    <strong style="color:#0D47A1;">📤 Leader's Note:</strong>
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
                const fileName = doc.fileName || 'No file';
                const version = doc.version || 1;
                const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt.seconds * 1000).toLocaleString() : 'N/A';
                return `
                    <div class="doc-item">
                        <div class="doc-name">${docLabels[key] || key}</div>
                        <div class="doc-detail">File: ${fileName}</div>
                        <div class="doc-detail">Version: ${version} • Uploaded: ${uploadedAt}</div>
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

// ============ REQUEST DETAIL VIEW ============

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
        const itemName = data.itemName || data.name || 'Request';
        const status = data.status || 'N/A';
        const submittedAt = data.submittedAt ? new Date(data.submittedAt.seconds * 1000).toLocaleString() : 'N/A';
        const amount = data.amount ? `R${data.amount.toLocaleString()}` : 'N/A';
        const type = data.type || 'N/A';
        const society = data.societyName || 'Unknown Society';
        const description = data.description || 'No description provided.';
        const documents = data.documents || {};
        const historyHtml = getRequestHistoryHtml(data.statusHistory || []);

        const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
        const docLabels = {
            'budgetForm': 'Budget Form',
            'meetingMinutes': 'Meeting Minutes',
            'vendorQuotation': 'Vendor Quotation'
        };

        let docsHtml = docOrder.map(key => {
            const doc = documents[key];
            if (!doc) {
                return `<div class="doc-item"><div class="doc-name">${docLabels[key] || key}</div><div class="doc-detail">No file uploaded</div></div>`;
            }
            const fileName = doc.fileName || 'No file';
            const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt.seconds * 1000).toLocaleString() : 'N/A';
            return `<div class="doc-item"><div class="doc-name">${docLabels[key] || key}</div><div class="doc-detail">${fileName}</div><div class="doc-detail">Uploaded: ${uploadedAt}</div></div>`;
        }).join('');

        const modalBody = `
            <div style="margin-bottom:14px;">
                <div style="font-size:14px;color:var(--text-600);margin-bottom:8px;">${society}</div>
                <div style="font-size:18px;font-weight:700;color:var(--navy-900);">${itemName}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">
                <div><strong>Status</strong><div style="margin-top:6px;">${status}</div></div>
                <div><strong>Submitted</strong><div style="margin-top:6px;">${submittedAt}</div></div>
                <div><strong>Amount</strong><div style="margin-top:6px;">${amount}</div></div>
                <div><strong>Type</strong><div style="margin-top:6px;">${type}</div></div>
            </div>
            <div style="margin-bottom:18px;"><strong>Description</strong><div style="margin-top:8px;color:var(--text-600);">${description}</div></div>
            <div style="margin-bottom:18px;">
                <h3 style="font-size:15px;color:var(--navy-900);margin-bottom:10px;">Documents</h3>
                ${docsHtml}
            </div>
            ${historyHtml}
        `;

        showModal(`Request Details - ${itemName}`, modalBody);
    } catch (error) {
        console.error('Error viewing request details:', error);
        alert('Error loading request details. ' + error.message);
    }
}

function getRequestHistoryHtml(history = []) {
    if (!Array.isArray(history) || history.length === 0) {
        return `<div class="history-empty" style="padding:16px 0;color:var(--text-500);font-size:13px;">No activity history yet.</div>`;
    }

    const sortedHistory = [...history].sort((a, b) => {
        const aTime = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
        const bTime = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
        return bTime - aTime;
    });

    return `
        <div class="history-list" style="margin-top:16px;">
            <h3 style="font-size:15px;color:var(--navy-900);margin-bottom:12px;">Activity Timeline</h3>
            ${sortedHistory.map(entry => {
                const when = entry.timestamp && entry.timestamp.toDate ? entry.timestamp.toDate().toLocaleString() : 'Unknown time';
                return `
                    <div class="history-item" style="padding:14px 16px;border:1px solid var(--border);border-radius:12px;margin-bottom:12px;background:#FAFBFD;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                            <span style="font-weight:600;color:var(--text-900);">${entry.status || 'Status changed'}</span>
                            <span style="font-size:12px;color:var(--text-500);">${when}</span>
                        </div>
                        <div style="margin-top:10px;font-size:13px;color:var(--text-600);">${entry.actorName || 'Officer'} · ${entry.actorRole || 'officer'}</div>
                        ${entry.note ? `<div style="margin-top:10px;font-size:13px;color:var(--text-600);">${entry.note}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function prepareStatusChange(requestId, newStatus) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    if (request.status === 'Approved' || request.status === 'Rejected') {
        alert('This request is locked and cannot be changed.');
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

    try {
        const actorName = localStorage.getItem('userName') || 'Officer';
        const actorRole = localStorage.getItem('userRole') || 'officer';

        await db.collection('requests').doc(requestId).update({
            status: newStatus,
            officerComment: newStatus === 'Revision Required' || newStatus === 'Rejected' ? statusNote : (newStatus === 'Under Review' ? statusNote : ''),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: newStatus,
                actorName,
                actorRole,
                note: statusNote || ''
            })
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
    }
}

// ============ MODAL FUNCTIONS ============

function showModal(title, bodyHTML) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('docModal').classList.add('active');
}

function closeModal() {
    document.getElementById('docModal').classList.remove('active');
}

// Close modal on overlay click
document.getElementById('docModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// ============ UPDATE STATUS ============

// ============ DELETE REQUEST ============

async function deleteRequest(requestId) {
    if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) return;

    try {
        await db.collection('requests').doc(requestId).delete();
        loadRequests();
    } catch (error) {
        console.error('Error deleting request:', error);
        alert('Error deleting request. ' + error.message);
    }
}

// ============ LOAD DATA ============

loadRequests();

// Make search function global for HTML
window.searchRequests = searchRequests;