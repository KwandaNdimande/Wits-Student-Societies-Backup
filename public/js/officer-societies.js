// ---------- SUPABASE INITIALIZATION (for consistency) ----------
const supabaseUrl = 'https://ovrqbcjaxwmxgujdxyea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cnFiY2pheHdteGd1amR4eWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzYwMzUsImV4cCI6MjEwMjIxMjAzNX0.ItYeye56cxBqkbaeOVS-66uX-uYM9f7T8C0F2tfqB_4';

// Create a global supabase client
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

let allSocieties = [];
let filteredSocieties = [];
let currentPage = 1;
const pageSize = 5;
let societyFilter = 'active';
let otherPortfolios = []; // Store other portfolios for the add form
let editingOtherPortfolios = []; // Store other portfolios for the edit form

// ================================================================
// VALIDATION HELPERS
// ================================================================

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function formatSocietyName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').split(' ').map(word =>
        word.split(/([-'])/).map(part => /^[a-z]/i.test(part)
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : part
        ).join('')
    ).join(' ');
}

async function societyApi(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Society request failed');
    return data;
}

function showFieldError(fieldName, message) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
    const inputEl = document.getElementById(fieldName);
    if (inputEl) {
        inputEl.classList.add('input-error');
    }
}

function hideFieldError(fieldName) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    if (errorEl) {
        errorEl.classList.remove('show');
        errorEl.textContent = '';
    }
    const inputEl = document.getElementById(fieldName);
    if (inputEl) {
        inputEl.classList.remove('input-error');
    }
}

function validateKeyPortfolios() {
    const requiredPortfolios = [
        { id: 'chairperson', label: 'Chairperson' },
        { id: 'deputychairperson', label: 'Deputy Chairperson' },
        { id: 'treasurer', label: 'Treasurer' },
        { id: 'secretary', label: 'Secretary' },
        { id: 'organiser', label: 'Organiser' }
    ];

    let isValid = true;

    requiredPortfolios.forEach(portfolio => {
        const nameInput = document.getElementById(`${portfolio.id}-name`);
        const emailInput = document.getElementById(`${portfolio.id}-email`);
        
        if (!nameInput || !emailInput) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        // Check name
        if (!name) {
            showFieldError(`${portfolio.id}-name`, `${portfolio.label} name is required`);
            isValid = false;
        } else {
            hideFieldError(`${portfolio.id}-name`);
        }

        // Check email
        if (!email) {
            showFieldError(`${portfolio.id}-email`, `${portfolio.label} email is required`);
            isValid = false;
        } else if (!isValidEmail(email)) {
            showFieldError(`${portfolio.id}-email`, `${portfolio.label} email is invalid`);
            isValid = false;
        } else {
            hideFieldError(`${portfolio.id}-email`);
        }
    });

    return isValid;
}

function validateEditKeyPortfolios() {
    const requiredPortfolios = [
        { id: 'edit-chairperson', label: 'Chairperson' },
        { id: 'edit-deputychairperson', label: 'Deputy Chairperson' },
        { id: 'edit-treasurer', label: 'Treasurer' },
        { id: 'edit-secretary', label: 'Secretary' },
        { id: 'edit-organiser', label: 'Organiser' }
    ];

    let isValid = true;

    requiredPortfolios.forEach(portfolio => {
        const nameInput = document.getElementById(`${portfolio.id}-name`);
        const emailInput = document.getElementById(`${portfolio.id}-email`);
        
        if (!nameInput || !emailInput) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        // Check name
        if (!name) {
            showFieldError(`${portfolio.id}-name`, `${portfolio.label} name is required`);
            isValid = false;
        } else {
            hideFieldError(`${portfolio.id}-name`);
        }

        // Check email
        if (!email) {
            showFieldError(`${portfolio.id}-email`, `${portfolio.label} email is required`);
            isValid = false;
        } else if (!isValidEmail(email)) {
            showFieldError(`${portfolio.id}-email`, `${portfolio.label} email is invalid`);
            isValid = false;
        } else {
            hideFieldError(`${portfolio.id}-email`);
        }
    });

    return isValid;
}

// Load societies
async function loadSocieties() {
    try {
        allSocieties = await societyApi('/api/societies');

        filteredSocieties = [...allSocieties];
        currentPage = 1;
        renderTable();

    } catch (error) {
        console.error('Error loading societies:', error);
        document.getElementById('societies-container').innerHTML = '<p style="color:#dc3545;text-align:center;padding:40px;">Error loading societies. Please try again.</p>';
    }
}

// Search function
function searchSocieties() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredSocieties = allSocieties.filter(s => societyFilter === 'all' ||
            (societyFilter === 'archived' ? s.status === 'archived' : s.status !== 'archived'));
    } else {
        filteredSocieties = allSocieties.filter(s =>
            (societyFilter === 'all' || (societyFilter === 'archived' ? s.status === 'archived' : s.status !== 'archived')) &&
            ((s.name && s.name.toLowerCase().includes(searchTerm)) ||
            (s.category && s.category.toLowerCase().includes(searchTerm)) ||
            (s.email && s.email.toLowerCase().includes(searchTerm)) ||
            (s.description && s.description.toLowerCase().includes(searchTerm)) ||
            (s.execCommittee && (
                (s.execCommittee.chairperson && (s.execCommittee.chairperson.name || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.chairperson && (s.execCommittee.chairperson.email || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.deputyChairperson && (s.execCommittee.deputyChairperson.name || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.deputyChairperson && (s.execCommittee.deputyChairperson.email || '').toLowerCase().includes(searchTerm)) ||
                // Backward compatibility for old key name
                (s.execCommittee.deputychairperson && (s.execCommittee.deputychairperson.name || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.deputychairperson && (s.execCommittee.deputychairperson.email || '').toLowerCase().includes(searchTerm))
            )))
        );
    }
    
    currentPage = 1;
    renderTable();
}

function setSocietyFilter(filter) {
    societyFilter = filter;
    document.querySelectorAll('[data-society-filter]').forEach(button => {
        button.classList.toggle('active', button.dataset.societyFilter === filter);
    });
    searchSocieties();
}

// Render table with pagination
function renderTable() {
    const container = document.getElementById('societies-container');
    const totalItems = filteredSocieties.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = filteredSocieties.slice(startIndex, endIndex);

    document.getElementById('resultsCount').textContent = `Showing ${totalItems > 0 ? startIndex + 1 : 0}-${endIndex} of ${totalItems} societies`;

    if (totalItems === 0) {
        container.innerHTML = `
            <div class="table-container">
                <div class="empty-state">No societies found.</div>
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
                        <th>Society Name</th>
                        <th>Category</th>
                        <th>Contact Email</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pageItems.forEach((s, index) => {
        const num = startIndex + index + 1;
        html += `
            <tr>
                <td style="color:#6c757d;font-weight:500;">${num}</td>
                <td class="strong">${s.name}</td>
                <td style="color:#6c757d;">${s.category || 'General'}</td>
                <td style="color:#6c757d;">${s.email || 'No email'}</td>
                <td>
                    <button class="btn-action btn-view-society" onclick="viewSociety('${s.id}')">View</button>
                    <button class="btn-action btn-edit-society" onclick="openEditSociety('${s.id}')">Edit</button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div class="pagination">
                <span class="info">Showing ${startIndex + 1}-${endIndex} of ${totalItems} societies</span>
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
    const totalPages = Math.ceil(filteredSocieties.length / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
}

// ================================================================
// OTHER PORTFOLIOS MANAGEMENT (ADD FORM)
// ================================================================

function addOtherPortfolio() {
    const title = document.getElementById('other-portfolio-title')?.value.trim();
    const name = document.getElementById('other-portfolio-name')?.value.trim();
    const email = document.getElementById('other-portfolio-email')?.value.trim();

    if (!title || !name || !email) {
        alert('Please fill in all portfolio fields.');
        return;
    }

    if (!isValidEmail(email)) {
        alert('Please enter a valid email for the portfolio.');
        return;
    }

    otherPortfolios.push({ title, name, email });

    // Clear inputs
    document.getElementById('other-portfolio-title').value = '';
    document.getElementById('other-portfolio-name').value = '';
    document.getElementById('other-portfolio-email').value = '';

    renderOtherPortfolios();
}

function removeOtherPortfolio(index) {
    otherPortfolios.splice(index, 1);
    renderOtherPortfolios();
}

function renderOtherPortfolios() {
    const container = document.getElementById('other-portfolios-list');
    if (otherPortfolios.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    otherPortfolios.forEach((portfolio, index) => {
        html += `
            <div class="portfolio-item">
                <div class="portfolio-item-content">
                    <div class="portfolio-item-field">
                        <label>Portfolio Title</label>
                        <span>${escapeHtml(portfolio.title)}</span>
                    </div>
                    <div class="portfolio-item-field">
                        <label>Member Name</label>
                        <span>${escapeHtml(portfolio.name)}</span>
                    </div>
                    <div class="portfolio-item-field">
                        <label>Member Email</label>
                        <span>${escapeHtml(portfolio.email)}</span>
                    </div>
                </div>
                <button type="button" class="btn-remove-portfolio" onclick="removeOtherPortfolio(${index})">Remove</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ================================================================
// OTHER PORTFOLIOS MANAGEMENT (EDIT FORM)
// ================================================================

function addEditOtherPortfolio() {
    const title = document.getElementById('edit-other-portfolio-title')?.value.trim();
    const name = document.getElementById('edit-other-portfolio-name')?.value.trim();
    const email = document.getElementById('edit-other-portfolio-email')?.value.trim();

    if (!title || !name || !email) {
        alert('Please fill in all portfolio fields.');
        return;
    }

    if (!isValidEmail(email)) {
        alert('Please enter a valid email for the portfolio.');
        return;
    }

    editingOtherPortfolios.push({ title, name, email });

    // Clear inputs
    document.getElementById('edit-other-portfolio-title').value = '';
    document.getElementById('edit-other-portfolio-name').value = '';
    document.getElementById('edit-other-portfolio-email').value = '';

    renderEditOtherPortfolios();
}

function removeEditOtherPortfolio(index) {
    editingOtherPortfolios.splice(index, 1);
    renderEditOtherPortfolios();
}

function renderEditOtherPortfolios() {
    const container = document.getElementById('edit-other-portfolios-list');
    if (!container) return;
    
    if (editingOtherPortfolios.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    editingOtherPortfolios.forEach((portfolio, index) => {
        html += `
            <div class="portfolio-item">
                <div class="portfolio-item-content">
                    <div class="portfolio-item-field">
                        <label>Portfolio Title</label>
                        <span>${escapeHtml(portfolio.title)}</span>
                    </div>
                    <div class="portfolio-item-field">
                        <label>Member Name</label>
                        <span>${escapeHtml(portfolio.name)}</span>
                    </div>
                    <div class="portfolio-item-field">
                        <label>Member Email</label>
                        <span>${escapeHtml(portfolio.email)}</span>
                    </div>
                </div>
                <button type="button" class="btn-remove-portfolio" onclick="removeEditOtherPortfolio(${index})">Remove</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ================================================================

// ================================================================
// ADD SOCIETY
// ================================================================

async function addSociety() {
    const name = formatSocietyName(document.getElementById('society-name').value);
    const category = document.getElementById('society-category').value;
    const email = document.getElementById('society-email').value.trim();
    const description = document.getElementById('society-description')?.value.trim() || '';
    
    // Basic validation
    if (!name || !category || !email) {
        alert('Please fill in all required society fields.');
        return;
    }

    // Validate key portfolios
    if (!validateKeyPortfolios()) {
        alert('Please complete all required key portfolios with valid names and emails.');
        return;
    }

    const execCommittee = {
        chairperson: {
            name: document.getElementById('chairperson-name')?.value.trim() || '',
            email: document.getElementById('chairperson-email')?.value.trim() || ''
        },
        deputyChairperson: {
            name: document.getElementById('deputychairperson-name')?.value.trim() || '',
            email: document.getElementById('deputychairperson-email')?.value.trim() || ''
        },
        treasurer: {
            name: document.getElementById('treasurer-name')?.value.trim() || '',
            email: document.getElementById('treasurer-email')?.value.trim() || ''
        },
        secretary: {
            name: document.getElementById('secretary-name')?.value.trim() || '',
            email: document.getElementById('secretary-email')?.value.trim() || ''
        },
        organiser: {
            name: document.getElementById('organiser-name')?.value.trim() || '',
            email: document.getElementById('organiser-email')?.value.trim() || ''
        },
        otherPortfolios: [...otherPortfolios]
    };

    try {
        const btn = document.querySelector('.btn-add');
        btn.disabled = true;
        btn.textContent = 'Adding...';

        await societyApi('/api/societies', {
            method: 'POST',
            body: JSON.stringify({
            name: name,
            category: category,
            email: email,
            description: description,
            execCommittee: execCommittee,
            createdBy: userUid,
            })
        });

        // Clear form
        document.getElementById('society-name').value = '';
        document.getElementById('society-category').value = '';
        document.getElementById('society-email').value = '';
        document.getElementById('society-description').value = '';
        document.getElementById('chairperson-name').value = '';
        document.getElementById('chairperson-email').value = '';
        document.getElementById('deputychairperson-name').value = '';
        document.getElementById('deputychairperson-email').value = '';
        document.getElementById('treasurer-name').value = '';
        document.getElementById('treasurer-email').value = '';
        document.getElementById('secretary-name').value = '';
        document.getElementById('secretary-email').value = '';
        document.getElementById('organiser-name').value = '';
        document.getElementById('organiser-email').value = '';
        document.getElementById('other-portfolio-title').value = '';
        document.getElementById('other-portfolio-name').value = '';
        document.getElementById('other-portfolio-email').value = '';

        otherPortfolios = [];
        renderOtherPortfolios();

        loadSocieties();
        alert('Society created successfully!');

    } catch (error) {
        console.error('Error adding society:', error);
        alert('Error adding society. ' + error.message);
    } finally {
        const btn = document.querySelector('.btn-add');
        btn.disabled = false;
        btn.textContent = 'Add Society';
    }
}

// ================================================================
// MODAL HELPERS
// ================================================================

function closeSocietyModal() {
    document.getElementById('societyModal').classList.remove('active');
    document.getElementById('societyModalBody').innerHTML = '';
    document.getElementById('societySaveBtn').style.display = 'none';
    document.getElementById('societyArchiveBtn').style.display = 'none';
    delete document.getElementById('societyModal').dataset.editingId;
    delete document.getElementById('societyModal').dataset.viewingId;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ================================================================
// VIEW SOCIETY (READ-ONLY MODAL)
// ================================================================

async function viewSociety(societyId) {
    try {
        const s = await societyApi(`/api/societies/${societyId}`);
        const exec = s.execCommittee || {};

        // Handle both old and new key names for backward compatibility
        const deputyChairperson = exec.deputyChairperson || exec.deputychairperson || {};

        let execHtml = `
                    <div class="exec-card">
                        <strong>Chairperson</strong>
                        <div class="name">${escapeHtml(exec.chairperson?.name || '—')}</div>
                        <div class="email">${escapeHtml(exec.chairperson?.email || '')}</div>
                    </div>
                    <div class="exec-card">
                        <strong>Deputy Chairperson</strong>
                        <div class="name">${escapeHtml(deputyChairperson?.name || '—')}</div>
                        <div class="email">${escapeHtml(deputyChairperson?.email || '')}</div>
                    </div>
                    <div class="exec-card">
                        <strong>Treasurer</strong>
                        <div class="name">${escapeHtml(exec.treasurer?.name || '—')}</div>
                        <div class="email">${escapeHtml(exec.treasurer?.email || '')}</div>
                    </div>
                    <div class="exec-card">
                        <strong>Secretary</strong>
                        <div class="name">${escapeHtml(exec.secretary?.name || '—')}</div>
                        <div class="email">${escapeHtml(exec.secretary?.email || '')}</div>
                    </div>
                    <div class="exec-card">
                        <strong>Organiser</strong>
                        <div class="name">${escapeHtml(exec.organiser?.name || '—')}</div>
                        <div class="email">${escapeHtml(exec.organiser?.email || '')}</div>
                    </div>
        `;

        // Add other portfolios if they exist
        if (exec.otherPortfolios && Array.isArray(exec.otherPortfolios) && exec.otherPortfolios.length > 0) {
            exec.otherPortfolios.forEach(portfolio => {
                portfolio = portfolio || {};
                execHtml += `
                    <div class="exec-card">
                        <strong>${escapeHtml(portfolio.title || 'Other Portfolio')}</strong>
                        <div class="name">${escapeHtml(portfolio.name || '—')}</div>
                        <div class="email">${escapeHtml(portfolio.email || '')}</div>
                    </div>
                `;
            });
        }

        const html = `
            <div class="view-detail" style="margin-bottom:16px;">
                <div style="font-size:20px;font-weight:700;color:var(--navy-900);">${escapeHtml(s.name)}</div>
                <div style="color:var(--text-500);font-size:14px;">${escapeHtml(s.category || 'General')}</div>
            </div>

            <div class="view-detail">
                <strong>Description</strong>
                <div class="value">${escapeHtml(s.description || 'No description provided.')}</div>
            </div>

            <div class="view-detail">
                <strong>Contact Email</strong>
                <div class="value">${escapeHtml(s.email || '—')}</div>
            </div>

            <div class="view-detail quota-options">
                <strong>Subscription Quota</strong>
                <label><input type="radio" name="subscription-quota" value="met" onchange="updateArchiveButton()"> Subscription Quota Met</label>
                <label><input type="radio" name="subscription-quota" value="not-met" onchange="updateArchiveButton()"> Subscription Quota Not Met</label>
            </div>

            <div style="margin-top:16px;">
                <h3 style="font-size:15px;color:var(--text-600);margin-bottom:10px;">Organogram</h3>
                <div class="exec-grid-view">
                    ${execHtml}
                </div>
            </div>
        `;

        document.getElementById('societyModalTitle').textContent = escapeHtml(s.name || 'Society');
        document.getElementById('societyModalBody').innerHTML = html;
        document.getElementById('societyModal').dataset.viewingId = societyId;
        document.getElementById('societySaveBtn').style.display = 'none';
        document.getElementById('societyArchiveBtn').style.display = s.status === 'archived' ? 'none' : 'inline-block';
        updateArchiveButton();
        document.getElementById('societyModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing society:', error);
        alert('Error viewing society. ' + error.message);
    }
}

function updateArchiveButton() {
    const archiveButton = document.getElementById('societyArchiveBtn');
    const selected = document.querySelector('input[name="subscription-quota"]:checked');
    archiveButton.disabled = !selected || selected.value !== 'not-met';
}

async function archiveSociety(societyId) {
    const selected = document.querySelector('input[name="subscription-quota"]:checked');
    if (!selected || selected.value !== 'not-met') return;
    if (!confirm('Archive this society because its subscription quota was not met?')) return;

    try {
        await societyApi(`/api/societies/${societyId}/archive`, {
            method: 'POST',
            body: JSON.stringify({ archivedBy: userUid, subscriptionQuota: selected.value })
        });
        closeSocietyModal();
        await loadSocieties();
        alert('Society archived successfully.');
    } catch (error) {
        console.error('Error archiving society:', error);
        alert('Error archiving society. ' + error.message);
    }
}

// ================================================================
// EDIT SOCIETY (EDITABLE MODAL)
// ================================================================

async function openEditSociety(societyId) {
    try {
        const s = await societyApi(`/api/societies/${societyId}`);
        const exec = s.execCommittee || {};

        // Handle both old and new key names for backward compatibility
        const deputyChairperson = exec.deputyChairperson || exec.deputychairperson || {};

        // Initialize other portfolios for editing
        editingOtherPortfolios = Array.isArray(exec.otherPortfolios) ? [...exec.otherPortfolios] : [];

        const html = `
            <div class="edit-grid">
                <input id="edit-soc-name" placeholder="Society Name" value="${escapeHtml(s.name || '')}" />
                <select id="edit-soc-category">
                    <option value="">Category...</option>
                    <option value="Academic" ${s.category === 'Academic' ? 'selected' : ''}>Academic</option>
                    <option value="Cultural" ${s.category === 'Cultural' ? 'selected' : ''}>Cultural</option>
                    <option value="Social" ${s.category === 'Social' ? 'selected' : ''}>Social</option>
                    <option value="Religious" ${s.category === 'Religious' ? 'selected' : ''}>Religious</option>
                    <option value="Political" ${s.category === 'Political' ? 'selected' : ''}>Political</option>
                    <option value="Business" ${s.category === 'Business' ? 'selected' : ''}>Business & Entrepreneur</option>
                </select>
                <input id="edit-soc-email" placeholder="Contact Email" value="${escapeHtml(s.email || '')}" />
                <textarea id="edit-soc-description" placeholder="Short description">${escapeHtml(s.description || '')}</textarea>

                <div class="exec-subgrid">
                    <div class="exec-col">
                        <label>Chairperson <span class="req-asterisk">*</span></label>
                        <input id="edit-chairperson-name" placeholder="Chairperson Name" value="${escapeHtml(exec.chairperson?.name || '')}" />
                        <input id="edit-chairperson-email" placeholder="Chairperson Email" value="${escapeHtml(exec.chairperson?.email || '')}" />
                        <div class="field-error" id="edit-chairperson-error"></div>
                    </div>
                    <div class="exec-col">
                        <label>Deputy Chairperson <span class="req-asterisk">*</span></label>
                        <input id="edit-deputychairperson-name" placeholder="Deputy Chairperson Name" value="${escapeHtml(deputyChairperson?.name || '')}" />
                        <input id="edit-deputychairperson-email" placeholder="Deputy Chairperson Email" value="${escapeHtml(deputyChairperson?.email || '')}" />
                        <div class="field-error" id="edit-deputychairperson-error"></div>
                    </div>
                    <div class="exec-col">
                        <label>Treasurer <span class="req-asterisk">*</span></label>
                        <input id="edit-treasurer-name" placeholder="Treasurer Name" value="${escapeHtml(exec.treasurer?.name || '')}" />
                        <input id="edit-treasurer-email" placeholder="Treasurer Email" value="${escapeHtml(exec.treasurer?.email || '')}" />
                        <div class="field-error" id="edit-treasurer-error"></div>
                    </div>
                    <div class="exec-col">
                        <label>Secretary <span class="req-asterisk">*</span></label>
                        <input id="edit-secretary-name" placeholder="Secretary Name" value="${escapeHtml(exec.secretary?.name || '')}" />
                        <input id="edit-secretary-email" placeholder="Secretary Email" value="${escapeHtml(exec.secretary?.email || '')}" />
                        <div class="field-error" id="edit-secretary-error"></div>
                    </div>
                    <div class="exec-col">
                        <label>Organiser <span class="req-asterisk">*</span></label>
                        <input id="edit-organiser-name" placeholder="Organiser Name" value="${escapeHtml(exec.organiser?.name || '')}" />
                        <input id="edit-organiser-email" placeholder="Organiser Email" value="${escapeHtml(exec.organiser?.email || '')}" />
                        <div class="field-error" id="edit-organiser-error"></div>
                    </div>
                </div>

                <div class="other-portfolios-section">
                    <div style="margin-bottom: 12px;">
                        <strong style="color: var(--text-900); font-size: 14px;">Optional: Add Other Portfolios</strong>
                    </div>
                    <div id="edit-other-portfolios-add" style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input id="edit-other-portfolio-title" placeholder="Portfolio Title" style="flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;" />
                        <input id="edit-other-portfolio-name" placeholder="Member Name" style="flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;" />
                        <input id="edit-other-portfolio-email" placeholder="Member Email" style="flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;" />
                        <button type="button" onclick="addEditOtherPortfolio()" style="padding: 10px 20px; background: var(--blue-600); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">Add</button>
                    </div>
                    <div id="edit-other-portfolios-list"></div>
                </div>
            </div>
        `;

        document.getElementById('societyModalTitle').textContent = `Edit: ${escapeHtml(s.name || 'Society')}`;
        document.getElementById('societyModalBody').innerHTML = html;
        document.getElementById('societyModal').dataset.editingId = societyId;
        document.getElementById('societySaveBtn').style.display = 'inline-block';
        document.getElementById('societyModal').classList.add('active');

        // Render existing other portfolios
        renderEditOtherPortfolios();
    } catch (error) {
        console.error('Error opening society for edit:', error);
        alert('Error opening society. ' + error.message);
    }
}

// ================================================================
// SAVE SOCIETY EDITS
// ================================================================

async function saveSocietyEdits() {
    const modal = document.getElementById('societyModal');
    const societyId = modal.dataset.editingId;
    if (!societyId) return;

    const name = document.getElementById('edit-soc-name')?.value.trim();
    const category = document.getElementById('edit-soc-category')?.value;
    const email = document.getElementById('edit-soc-email')?.value.trim();
    const description = document.getElementById('edit-soc-description')?.value.trim() || '';

    // Basic validation
    if (!name || !category || !email) {
        alert('Please fill in all required society fields.');
        return;
    }

    // Validate key portfolios
    if (!validateEditKeyPortfolios()) {
        alert('Please complete all required key portfolios with valid names and emails.');
        return;
    }

    const execCommittee = {
        chairperson: {
            name: document.getElementById('edit-chairperson-name')?.value.trim() || '',
            email: document.getElementById('edit-chairperson-email')?.value.trim() || ''
        },
        deputyChairperson: {
            name: document.getElementById('edit-deputychairperson-name')?.value.trim() || '',
            email: document.getElementById('edit-deputychairperson-email')?.value.trim() || ''
        },
        treasurer: {
            name: document.getElementById('edit-treasurer-name')?.value.trim() || '',
            email: document.getElementById('edit-treasurer-email')?.value.trim() || ''
        },
        secretary: {
            name: document.getElementById('edit-secretary-name')?.value.trim() || '',
            email: document.getElementById('edit-secretary-email')?.value.trim() || ''
        },
        organiser: {
            name: document.getElementById('edit-organiser-name')?.value.trim() || '',
            email: document.getElementById('edit-organiser-email')?.value.trim() || ''
        },
        otherPortfolios: [...editingOtherPortfolios]
    };

    try {
        await societyApi(`/api/societies/${societyId}`, {
            method: 'PUT',
            body: JSON.stringify({
            name,
            category,
            email,
            description,
            execCommittee,
            })
        });

        closeSocietyModal();
        loadSocieties();
        alert('Society updated successfully!');
    } catch (error) {
        console.error('Error saving society edits:', error);
        alert('Error saving society. ' + error.message);
    }
}

// ================================================================
// ================================================================
// LOAD DATA
// ================================================================

loadSocieties();