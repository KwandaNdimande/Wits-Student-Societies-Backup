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
                (s.execCommittee.president && (s.execCommittee.president.name || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.president && (s.execCommittee.president.email || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.vicePresident && (s.execCommittee.vicePresident.name || '').toLowerCase().includes(searchTerm)) ||
                (s.execCommittee.vicePresident && (s.execCommittee.vicePresident.email || '').toLowerCase().includes(searchTerm))
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
    
    // Ensure current page is valid
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = filteredSocieties.slice(startIndex, endIndex);

    // Update results count
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
                    <button class="btn-view" onclick="viewSociety('${s.id}')">View</button>
                    <button class="btn-view" style="margin-left:8px;" onclick="openEditSociety('${s.id}')">Edit</button>
                    <button class="btn-delete" style="margin-left:8px;" onclick="deleteSociety('${s.id}')">Delete</button>
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

    // Generate page numbers
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

// Add new society
async function addSociety() {
    const name = document.getElementById('society-name').value.trim();
    const category = document.getElementById('society-category').value;
    const email = document.getElementById('society-email').value.trim();
    const description = document.getElementById('society-description')?.value.trim() || '';
    const execCommittee = {
        president: {
            name: document.getElementById('president-name')?.value.trim() || '',
            email: document.getElementById('president-email')?.value.trim() || ''
        },
        vicePresident: {
            name: document.getElementById('vp-name')?.value.trim() || '',
            email: document.getElementById('vp-email')?.value.trim() || ''
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

        document.getElementById('society-name').value = '';
        document.getElementById('society-category').value = '';
        document.getElementById('society-email').value = '';

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

// Modal helpers for viewing and editing societies
function closeSocietyModal() {
    const overlay = document.getElementById('societyModal');
    if (overlay) overlay.style.display = 'none';
    document.getElementById('societyModalBody').innerHTML = '';
    document.getElementById('societySaveBtn').style.display = 'none';
    delete document.getElementById('societyModal')?.dataset.editingId;
}

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
            <div style="margin-bottom:12px;"><strong style="font-size:16px;color:var(--navy-900);">${s.name}</strong><div style="color:var(--text-500);">${s.category || ''}</div></div>
            <div style="margin-bottom:12px;"><strong>Description</strong><div style="margin-top:6px;color:var(--text-600);">${s.description || '—'}</div></div>
            <div style="margin-bottom:12px;"><strong>Contact Email</strong><div style="margin-top:6px;color:var(--text-600);">${s.email || '—'}</div></div>
            <div style="margin-top:12px;"><h3 style="margin-bottom:8px;">Executive Committee</h3>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                    <div><strong>President</strong><div>${exec.president?.name || '—'}</div><div style="font-size:13px;color:var(--text-500);">${exec.president?.email || ''}</div></div>
                    <div><strong>Vice President</strong><div>${exec.vicePresident?.name || '—'}</div><div style="font-size:13px;color:var(--text-500);">${exec.vicePresident?.email || ''}</div></div>
                    <div><strong>Treasurer</strong><div>${exec.treasurer?.name || '—'}</div><div style="font-size:13px;color:var(--text-500);">${exec.treasurer?.email || ''}</div></div>
                    <div><strong>Secretary</strong><div>${exec.secretary?.name || '—'}</div><div style="font-size:13px;color:var(--text-500);">${exec.secretary?.email || ''}</div></div>
                </div>
            </div>
        `;

        document.getElementById('societyModalTitle').textContent = s.name || 'Society';
        document.getElementById('societyModalBody').innerHTML = html;
        document.getElementById('societySaveBtn').style.display = 'none';
        document.getElementById('societyModal').style.display = 'flex';
    } catch (error) {
        console.error('Error viewing society:', error);
        alert('Error viewing society. ' + error.message);
    }
}

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
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input id="edit-soc-name" placeholder="Society Name" value="${escapeHtml(s.name || '')}" />
                <select id="edit-soc-category"><option value="">Category...</option><option value="Academic">Academic</option><option value="Cultural">Cultural</option><option value="Sports">Sports</option><option value="Religious">Religious</option><option value="Other">Other</option></select>
                <input id="edit-soc-email" placeholder="Contact Email" value="${escapeHtml(s.email || '')}" />
                <textarea id="edit-soc-description" placeholder="Short description" style="grid-column:1 / -1;min-height:72px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;">${escapeHtml(s.description || '')}</textarea>
                <div style="grid-column:1 / -1;display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;">
                    <div>
                        <strong style="display:block;margin-bottom:6px;color:var(--text-900);">President</strong>
                        <input id="edit-president-name" placeholder="President Name" value="${escapeHtml(exec.president?.name || '')}" />
                        <input id="edit-president-email" placeholder="President Email" value="${escapeHtml(exec.president?.email || '')}" style="margin-top:8px;" />
                    </div>
                    <div>
                        <strong style="display:block;margin-bottom:6px;color:var(--text-900);">Vice President</strong>
                        <input id="edit-vp-name" placeholder="Vice President Name" value="${escapeHtml(exec.vicePresident?.name || '')}" />
                        <input id="edit-vp-email" placeholder="Vice President Email" value="${escapeHtml(exec.vicePresident?.email || '')}" style="margin-top:8px;" />
                    </div>
                    <div>
                        <strong style="display:block;margin-bottom:6px;color:var(--text-900);">Treasurer</strong>
                        <input id="edit-treasurer-name" placeholder="Treasurer Name" value="${escapeHtml(exec.treasurer?.name || '')}" />
                        <input id="edit-treasurer-email" placeholder="Treasurer Email" value="${escapeHtml(exec.treasurer?.email || '')}" style="margin-top:8px;" />
                    </div>
                    <div>
                        <strong style="display:block;margin-bottom:6px;color:var(--text-900);">Secretary</strong>
                        <input id="edit-secretary-name" placeholder="Secretary Name" value="${escapeHtml(exec.secretary?.name || '')}" />
                        <input id="edit-secretary-email" placeholder="Secretary Email" value="${escapeHtml(exec.secretary?.email || '')}" style="margin-top:8px;" />
                    </div>
                </div>
            </div>
        `;

        document.getElementById('societyModalTitle').textContent = `Edit: ${s.name || 'Society'}`;
        document.getElementById('societyModalBody').innerHTML = html;
        // set category select value after inserting
        const catSelect = document.getElementById('edit-soc-category');
        if (catSelect) catSelect.value = s.category || '';

        const saveBtn = document.getElementById('societySaveBtn');
        saveBtn.style.display = 'inline-block';
        document.getElementById('societyModal').dataset.editingId = societyId;
        document.getElementById('societyModal').style.display = 'flex';
    } catch (error) {
        console.error('Error opening society for edit:', error);
        alert('Error opening society. ' + error.message);
    }
}

async function saveSocietyEdits() {
    const modal = document.getElementById('societyModal');
    const societyId = modal.dataset.editingId;
    if (!societyId) return;

    const name = document.getElementById('edit-soc-name')?.value.trim();
    const category = document.getElementById('edit-soc-category')?.value;
    const email = document.getElementById('edit-soc-email')?.value.trim();
    const description = document.getElementById('edit-soc-description')?.value.trim() || '';
    const execCommittee = {
        president: { name: document.getElementById('edit-president-name')?.value.trim() || '', email: document.getElementById('edit-president-email')?.value.trim() || '' },
        vicePresident: { name: document.getElementById('edit-vp-name')?.value.trim() || '', email: document.getElementById('edit-vp-email')?.value.trim() || '' },
        treasurer: { name: document.getElementById('edit-treasurer-name')?.value.trim() || '', email: document.getElementById('edit-treasurer-email')?.value.trim() || '' },
        secretary: { name: document.getElementById('edit-secretary-name')?.value.trim() || '', email: document.getElementById('edit-secretary-email')?.value.trim() || '' }
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
    } catch (error) {
        console.error('Error saving society edits:', error);
        alert('Error saving society. ' + error.message);
    }
}

// small escaping helper for value injection
function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Delete society
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

// Load data
loadSocieties();