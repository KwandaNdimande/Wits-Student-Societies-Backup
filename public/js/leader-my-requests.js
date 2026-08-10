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
if (!userUid) {
    window.location.href = '/login.html';
}

let currentRequestId = null;
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
    "Resubmitted": "status-under-review"
};

// Document labels
const docLabels = {
    'budgetForm': 'Budget Form',
    'meetingMinutes': 'Meeting Minutes',
    'vendorQuotation': 'Vendor Quotation'
};

// Load requests
async function loadRequests() {
    try {
        const requestsSnapshot = await db.collection('requests')
            .where('submittedBy', '==', userUid)
            .orderBy('submittedAt', 'desc')
            .get();

        allRequests = [];
        requestsSnapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
        });

        filteredRequests = [...allRequests];
        currentPage = 1;
        renderTable();
        renderLeaderNotifications();
        openLeaderNotificationFromUrl();

    } catch (error) {
        console.error('Error loading requests:', error);
        document.getElementById('requests-container').innerHTML = '<p style="color:#dc3545;text-align:center;padding:40px;">Error loading requests. Please try again.</p>';
    }
}

// Notification helpers
function getTimestampMs(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp === 'number') return timestamp;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (timestamp.seconds) return timestamp.seconds * 1000 + Math.round((timestamp.nanoseconds || 0) / 1e6);
    return Date.parse(timestamp) || 0;
}

function initLeaderNotificationBell() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks || navLinks.querySelector('.nav-bell')) return;

    const bell = document.createElement('div');
    bell.className = 'nav-bell';
    bell.innerHTML = `
        <button id="notificationBell" class="nav-bell-btn" type="button" aria-haspopup="true" aria-expanded="false">
            🔔 <span id="notificationCount" class="notification-badge hidden">0</span>
        </button>
        <div id="notificationDropdown" class="notification-dropdown"></div>
    `;
    navLinks.prepend(bell);

    document.getElementById('notificationBell').addEventListener('click', function(event) {
        event.stopPropagation();
        toggleLeaderDropdown();
    });

    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('notificationDropdown');
        const bell = document.getElementById('notificationBell');
        if (!dropdown || !dropdown.classList.contains('active')) return;
        if (bell.contains(event.target) || dropdown.contains(event.target)) return;
        closeLeaderDropdown();
    });
}

function renderLeaderNotifications() {
    initLeaderNotificationBell();

    const lastSeen = parseInt(localStorage.getItem('leaderNotificationsLastSeen') || '0', 10);
    const events = [];

    allRequests.forEach(request => {
        const history = request.statusHistory || [];
        history.forEach(entry => {
            if (entry.actorRole !== 'officer') return;
            const ts = getTimestampMs(entry.timestamp);
            if (ts <= lastSeen) return;
            events.push({ request, entry, ts });
        });
    });

    events.sort((a, b) => b.ts - a.ts);

    const badge = document.getElementById('notificationCount');
    if (badge) {
        if (events.length > 0) {
            badge.textContent = events.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;

    if (events.length === 0) {
        dropdown.innerHTML = '<div class="notification-item empty">No new request updates.</div>';
        return;
    }

    dropdown.innerHTML = events.slice(0, 5).map(item => {
        const request = item.request;
        const entry = item.entry;
        const when = new Date(item.ts).toLocaleString();
        const title = request.itemName || request.name || 'Request';
        return `
            <div class="notification-item" onclick="openLeaderNotification('${request.id}')">
                <div class="title">${title} — ${entry.status || 'Updated'}</div>
                <div class="meta">${request.societyName || ''} · ${when}</div>
                ${entry.note ? `<div class="note">${entry.note}</div>` : ''}
            </div>
        `;
    }).join('');
}

function toggleLeaderDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;
    const isActive = dropdown.classList.toggle('active');
    if (isActive) {
        localStorage.setItem('leaderNotificationsLastSeen', Date.now().toString());
        renderLeaderNotifications();
    }
}

function closeLeaderDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

function openLeaderNotification(requestId) {
    closeLeaderDropdown();
    window.location.href = `/leader/my-requests.html?openRequest=${encodeURIComponent(requestId)}`;
}

function openLeaderNotificationFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('openRequest');
    if (requestId) {
        openDetailView(requestId);
    }
}

// Search function
function searchRequests() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase().trim() || '';
    
    if (searchTerm === '') {
        filteredRequests = [...allRequests];
    } else {
        filteredRequests = allRequests.filter(r => 
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
                <div class="empty-state">
                    <p>No requests found.</p>
                    <a href="/leader/new-request.html">Submit Your First Request</a>
                </div>
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
                        <th>Request</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pageItems.forEach((r, index) => {
        const num = startIndex + index + 1;
        const statusClass = statusColors[r.status] || 'status-submitted';
        const isRevision = r.status === 'Revision Required';
        // Only show officer comment when status is Revision Required
        const hasOfficerComment = r.status === 'Revision Required' && r.officerComment && r.officerComment !== '';
        
        html += `
            <tr class="clickable-row" onclick="openDetailView('${r.id}')">
                <td style="color:#6c757d;font-weight:500;">${num}</td>
                <td class="strong">${r.itemName || r.name || 'Untitled'}</td>
                <td style="color:#6c757d;">${r.type || 'N/A'}</td>
                <td>R${r.amount ? r.amount.toLocaleString() : '0'}</td>
                <td style="color:#6c757d;">${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <span class="status-badge ${statusClass}">${r.status || 'N/A'}</span>
                    ${hasOfficerComment ? `<br><span style="font-size:11px;color:#E65100;">📝 ${r.officerComment}</span>` : ''}
                </td>
                <td>
                    ${isRevision ? `<button class="btn-update" onclick="event.stopPropagation(); openUpdateModal('${r.id}')">Update Documents</button>` : '—'}
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

function openDetailView(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    document.getElementById('controls').classList.add('hidden');
    document.getElementById('requests-container').classList.add('hidden');
    document.getElementById('request-detail-view').classList.remove('hidden');

    document.getElementById('detail-title').textContent = request.itemName || 'Request Details';
    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = request.status || 'N/A';
    statusEl.className = `status-badge ${statusColors[request.status] || 'status-submitted'}`;

    const amountText = request.amount ? `R${request.amount.toLocaleString()}` : 'N/A';
    const submittedDate = request.submittedAt ? new Date(request.submittedAt.seconds * 1000).toLocaleString() : 'N/A';
    const description = request.description || 'No description provided.';
    const documents = request.documents || {};
    const officerComment = request.officerComment ? `<div class="officer-comment"><strong>Officer Feedback:</strong> ${request.officerComment}</div>` : '';
    const leaderComment = request.leaderComment ? `<div style="margin-top:12px;color:#2E6FBA;font-size:14px;"><strong>Your comment:</strong> ${request.leaderComment}</div>` : '';

    const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
    const docsHtml = docOrder.map(key => {
        const label = docLabels[key] || key;
        const file = documents[key];
        const fileName = file?.fileName || file?.name || file || 'No file uploaded';
        return `<div class="doc-item"><strong>${label}</strong><div>${fileName}</div></div>`;
    }).join('');

    document.getElementById('detailBody').innerHTML = `
        <div class="detail-row"><div class="detail-label">Request Type</div><div class="detail-value">${request.type || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Amount</div><div class="detail-value">${amountText}</div></div>
        <div class="detail-row"><div class="detail-label">Submitted</div><div class="detail-value">${submittedDate}</div></div>
        <div class="detail-row"><div class="detail-label">Description</div><div class="detail-value">${description}</div></div>
        ${officerComment}
        ${leaderComment}
        <div class="detail-docs"><h3 style="font-size:15px;color:var(--text-600);margin-bottom:10px;">Documents</h3>${docsHtml}</div>
    `;
}

function closeDetailView() {
    document.getElementById('request-detail-view').classList.add('hidden');
    document.getElementById('requests-container').classList.remove('hidden');
    document.getElementById('controls').classList.remove('hidden');
}

// ============ UPDATE DOCUMENTS MODAL ============

async function openUpdateModal(requestId) {
    currentRequestId = requestId;
    
    try {
        const docRef = await db.collection('requests').doc(requestId).get();
        if (!docRef.exists) {
            alert('Request not found.');
            return;
        }

        const data = docRef.data();
        const itemName = data.itemName || 'Request';
        const officerComment = data.officerComment || '';

        let modalBody = `
            <div style="margin-bottom:20px;">
                <div style="font-size:14px;color:var(--text-600);margin-bottom:4px;"><strong>Request:</strong> ${itemName}</div>
                <div style="font-size:13px;color:var(--text-500);">Update the documents below to resubmit your request.</div>
            </div>
        `;

        if (officerComment) {
            modalBody += `
                <div style="background:#FFF3E0;padding:14px 16px;border-radius:8px;margin-bottom:20px;border-left:4px solid #E65100;">
                    <strong style="color:#E65100;font-size:13px;">📝 Officer's Feedback</strong>
                    <p style="color:#5A6B87;font-size:14px;margin:4px 0 0;">${officerComment}</p>
                </div>
            `;
        }

        modalBody += `
            <p style="color:#E65100;font-size:14px;margin-bottom:20px;background:#FFF3E0;padding:12px 16px;border-radius:8px;border-left:4px solid #E65100;">
                ⚠️ Please upload corrected documents below. All files must be in the correct format.
            </p>
        `;

        const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
        const fileConfigs = {
            'budgetForm': { label: 'Budget Form', accept: '.xlsx,.xls', hint: 'Excel file required' },
            'meetingMinutes': { label: 'Meeting Minutes', accept: '.pdf', hint: 'PDF only' },
            'vendorQuotation': { label: 'Vendor Quotation', accept: '.pdf', hint: 'PDF only' }
        };

        docOrder.forEach(key => {
            const config = fileConfigs[key];
            const label = config.label;
            const accept = config.accept;
            const hint = config.hint;
            
            modalBody += `
                <div class="form-group" style="margin-bottom:16px;">
                    <label style="display:block;font-size:13px;font-weight:600;color:var(--text-600);margin-bottom:4px;">${label}</label>
                    <div style="font-size:12px;color:var(--text-500);margin-bottom:4px;">Current: <strong style="color:#D64545;">No file uploaded</strong></div>
                    <div class="file-input">
                        <input type="file" id="file_${key}" accept="${accept}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;background:var(--surface);" />
                        <div style="font-size:12px;color:var(--text-500);margin-top:4px;">Upload new version (${hint})</div>
                        <div class="form-error" id="file_${key}_error" style="font-size:12px;color:#D64545;margin-top:4px;min-height:18px;"></div>
                    </div>
                </div>
            `;
        });

        modalBody += `
            <div class="comment-area" style="margin-top:16px;">
                <label style="display:block;font-weight:600;font-size:13px;color:var(--text-600);margin-bottom:4px;">Add Comment (Optional)</label>
                <textarea id="updateComment" placeholder="Describe the changes you've made..." style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:'Inter',sans-serif;resize:vertical;min-height:60px;"></textarea>
                <div class="form-error" id="updateComment-error" style="font-size:12px;color:#D64545;margin-top:4px;min-height:18px;"></div>
            </div>
            <div class="modal-footer" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:12px;">
                <button class="btn btn-primary" id="updateResubmitBtn" onclick="submitUpdate()" style="font-family:'Inter',sans-serif;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;transition:all 0.2s ease;background:var(--navy-900);color:#fff;">Resubmit</button>
                <button class="btn btn-secondary" onclick="closeUpdateModal()" style="font-family:'Inter',sans-serif;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;transition:all 0.2s ease;background:var(--border);color:var(--text-600);">Cancel</button>
            </div>
        `;

        document.getElementById('modalTitle').textContent = 'Update Documents';
        document.getElementById('modalBody').innerHTML = modalBody;
        document.getElementById('updateModal').classList.add('active');

        // Add file validation listeners
        docOrder.forEach(key => {
            const fileInput = document.getElementById(`file_${key}`);
            if (fileInput) {
                fileInput.addEventListener('change', function() {
                    validateUpdateFile(key, this);
                    checkUpdateFormValidity();
                });
            }
        });

        // Initial validation check
        checkUpdateFormValidity();

    } catch (error) {
        console.error('Error loading documents:', error);
        alert('Error loading documents. ' + error.message);
    }
}

// ============ UPDATE FORM VALIDATION ============

function validateUpdateFile(key, input) {
    const errorEl = document.getElementById(`file_${key}_error`);
    if (!errorEl) return;
    
    const file = input.files[0];
    if (!file) {
        errorEl.textContent = '';
        return;
    }
    
    const configs = {
        'budgetForm': { accept: ['.xlsx', '.xls'], label: 'Excel' },
        'meetingMinutes': { accept: ['.pdf'], label: 'PDF' },
        'vendorQuotation': { accept: ['.pdf'], label: 'PDF' }
    };
    
    const config = configs[key];
    if (!config) return;
    
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!config.accept.includes(fileExt)) {
        errorEl.textContent = `Please upload a ${config.label} file (${config.accept.join(', ')}).`;
        input.style.borderColor = '#D64545';
    } else {
        errorEl.textContent = '';
        input.style.borderColor = '';
    }
}

function checkUpdateFormValidity() {
    const btn = document.getElementById('updateResubmitBtn');
    if (!btn) return;
    
    const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
    let hasFile = false;
    let hasError = false;
    
    docOrder.forEach(key => {
        const input = document.getElementById(`file_${key}`);
        const errorEl = document.getElementById(`file_${key}_error`);
        if (input && input.files && input.files[0]) {
            hasFile = true;
            if (errorEl && errorEl.textContent) {
                hasError = true;
            }
        }
    });
    
    // Enable button if at least one file is selected and no errors
    btn.disabled = !hasFile || hasError;
    btn.style.opacity = btn.disabled ? '0.6' : '1';
    btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
}

// ============ SUBMIT UPDATE ============

async function submitUpdate() {
    if (!currentRequestId) return;

    const btn = document.getElementById('updateResubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';

    try {
        const docRef = await db.collection('requests').doc(currentRequestId).get();
        const data = docRef.data();
        const currentDocs = data.documents || {};
        const updatedDocs = { ...currentDocs };

        const docOrder = ['budgetForm', 'meetingMinutes', 'vendorQuotation'];
        let hasUpdate = false;

        docOrder.forEach(key => {
            const fileInput = document.getElementById(`file_${key}`);
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                // Handle both string and object formats
                const currentDoc = updatedDocs[key];
                let currentVersion = 1;
                if (typeof currentDoc === 'object' && currentDoc !== null) {
                    currentVersion = currentDoc.version || 1;
                }
                // Save as object with full metadata
                updatedDocs[key] = {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    version: currentVersion + 1,
                    isCurrent: true
                };
                hasUpdate = true;
            }
        });

        if (!hasUpdate) {
            alert('Please select at least one file to update.');
            btn.disabled = false;
            btn.textContent = 'Resubmit';
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            return;
        }

        const comment = document.getElementById('updateComment')?.value || '';

        await db.collection('requests').doc(currentRequestId).update({
            documents: updatedDocs,
            status: 'Resubmitted',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            leaderComment: comment
        });

        closeUpdateModal();
        loadRequests();
        alert('✅ Documents updated successfully. Your request has been resubmitted for review.');

    } catch (error) {
        console.error('Error updating documents:', error);
        alert('Error updating documents. ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Resubmit';
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

// ============ MODAL FUNCTIONS ============

function closeUpdateModal() {
    document.getElementById('updateModal').classList.remove('active');
    currentRequestId = null;
}

// Close modal on overlay click
document.getElementById('updateModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeUpdateModal();
    }
});

// Make search function global
window.searchRequests = searchRequests;

// ============ LOAD DATA ============

loadRequests();