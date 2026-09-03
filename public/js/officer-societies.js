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

// Load societies
async function loadSocieties() {
    try {
        const societiesSnapshot = await db.collection('societies')
            .orderBy('name', 'asc')
            .get();

        allSocieties = [];
        societiesSnapshot.forEach(doc => {
            allSocieties.push({ id: doc.id, ...doc.data() });
        });

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
        filteredSocieties = [...allSocieties];
    } else {
        filteredSocieties = allSocieties.filter(s => 
            (s.name && s.name.toLowerCase().includes(searchTerm)) ||
            (s.category && s.category.toLowerCase().includes(searchTerm)) ||
            (s.email && s.email.toLowerCase().includes(searchTerm)) ||
            (s.description && s.description.toLowerCase().includes(searchTerm)) ||
            (s.execCommittee && (
                (s.execCommittee.chairperson && (s.execCommittee.chairperson.name || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.chairperson && (s.execCommittee.chairperson.email || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.deputychairperson && (s.execCommittee.deputychairperson.name || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.deputychairperson && (s.execCommittee.deputychairperson.email || '').toLowerCase().includes(searchTerm))
            ))
        );
    }
    
    currentPage = 1;
    renderTable();
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
                    <button class="btn-action btn-delete-society" onclick="deleteSociety('${s.id}')">Delete</button>
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
// ADD SOCIETY
// ================================================================

async function addSociety() {
    const name = document.getElementById('society-name').value.trim();
    const category = document.getElementById('society-category').value;
    const email = document.getElementById('society-email').value.trim();
    const description = document.getElementById('society-description')?.value.trim() || '';
    const execCommittee = {
        chairperson: {
            name: document.getElementById('chairperson-name')?.value.trim() || '',
            email: document.getElementById('chairperson-email')?.value.trim() || ''
        },
        deputychairperson: {
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
        }
    };

    if (!name || !category || !email) {
        alert('Please fill in all fields.');
        return;
    }

    try {
        const btn = document.querySelector('.btn-add');
        btn.disabled = true;
        btn.textContent = 'Adding...';

        await db.collection('societies').add({
            name: name,
            category: category,
            email: email,
            description: description,
            execCommittee: execCommittee,
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
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

        loadSocieties();

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
    delete document.getElementById('societyModal').dataset.editingId;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ================================================================
// VIEW SOCIETY (READ-ONLY MODAL)
// ================================================================

async function viewSociety(societyId) {
    try {
        const doc = await db.collection('societies').doc(societyId).get();
        if (!doc.exists) {
            alert('Society not found.');
            return;
        }
        const s = doc.data();
        const exec = s.execCommittee || {};

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

            <div style="margin-top:16px;">
                <h3 style="font-size:15px;color:var(--text-600);margin-bottom:10px;">Executive Committee</h3>
                <div class="exec-grid-view">
                    <div class="exec-card">
                        <strong>Chairperson</strong>
                        <div class="name">${escapeHtml(exec.chairperson?.name || '—')}</div>
                        <div class="email">${escapeHtml(exec.chairperson?.email || '')}</div>
                    </div>
                    <div class="exec-card">
                        <strong>Deputy Chairperson</strong>
                        <div class="name">${escapeHtml(exec.deputychairperson?.name || '—')}</div>
                        <div class="email">${escapeHtml(exec.deputychairperson?.email || '')}</div>
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
                </div>
            </div>
        `;

        document.getElementById('societyModalTitle').textContent = escapeHtml(s.name || 'Society');
        document.getElementById('societyModalBody').innerHTML = html;
        document.getElementById('societySaveBtn').style.display = 'none';
        document.getElementById('societyModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing society:', error);
        alert('Error viewing society. ' + error.message);
    }
}

// ================================================================
// EDIT SOCIETY (EDITABLE MODAL)
// ================================================================

async function openEditSociety(societyId) {
    try {
        const doc = await db.collection('societies').doc(societyId).get();
        if (!doc.exists) {
            alert('Society not found.');
            return;
        }
        const s = doc.data();
        const exec = s.execCommittee || {};

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
                        <label>Chairperson</label>
                        <input id="edit-chairperson-name" placeholder="Chairperson Name" value="${escapeHtml(exec.chairperson?.name || '')}" />
                        <input id="edit-chairperson-email" placeholder="Chairperson Email" value="${escapeHtml(exec.chairperson?.email || '')}" />
                    </div>
                    <div class="exec-col">
                        <label>Deputy Chairperson</label>
                        <input id="edit-deputychairperson-name" placeholder="Deputy Chairperson Name" value="${escapeHtml(exec.deputychairperson?.name || '')}" />
                        <input id="edit-deputychairperson-email" placeholder="Deputy Chairperson Email" value="${escapeHtml(exec.deputychairperson?.email || '')}" />
                    </div>
                    <div class="exec-col">
                        <label>Treasurer</label>
                        <input id="edit-treasurer-name" placeholder="Treasurer Name" value="${escapeHtml(exec.treasurer?.name || '')}" />
                        <input id="edit-treasurer-email" placeholder="Treasurer Email" value="${escapeHtml(exec.treasurer?.email || '')}" />
                    </div>
                    <div class="exec-col">
                        <label>Secretary</label>
                        <input id="edit-secretary-name" placeholder="Secretary Name" value="${escapeHtml(exec.secretary?.name || '')}" />
                        <input id="edit-secretary-email" placeholder="Secretary Email" value="${escapeHtml(exec.secretary?.email || '')}" />
                    </div>
                </div>
            </div>
        `;

        document.getElementById('societyModalTitle').textContent = `Edit: ${escapeHtml(s.name || 'Society')}`;
        document.getElementById('societyModalBody').innerHTML = html;
        document.getElementById('societyModal').dataset.editingId = societyId;
        document.getElementById('societySaveBtn').style.display = 'inline-block';
        document.getElementById('societyModal').classList.add('active');
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
    const execCommittee = {
        chairperson: {
            name: document.getElementById('edit-chairperson-name')?.value.trim() || '',
            email: document.getElementById('edit-chairperson-email')?.value.trim() || ''
        },
        deputychairperson: {
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
        }
    };

    if (!name || !category || !email) {
        alert('Please fill in name, category and contact email.');
        return;
    }

    try {
        await db.collection('societies').doc(societyId).update({
            name,
            category,
            email,
            description,
            execCommittee,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
// DELETE SOCIETY
// ================================================================

async function deleteSociety(societyId) {
    if (!confirm('Are you sure you want to delete this society? This cannot be undone.')) return;

    try {
        await db.collection('societies').doc(societyId).delete();
        loadSocieties();
    } catch (error) {
        console.error('Error deleting society:', error);
        alert('Error deleting society. ' + error.message);
    }
}

// ================================================================
// LOAD DATA
// ================================================================

loadSocieties();