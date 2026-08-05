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
            s.name.toLowerCase().includes(searchTerm) ||
            s.category.toLowerCase().includes(searchTerm) ||
            s.email.toLowerCase().includes(searchTerm)
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
                    <button class="btn-delete" onclick="deleteSociety('${s.id}')">Delete</button>
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
            createdBy: userUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('society-name').value = '';
        document.getElementById('society-category').value = '';
        document.getElementById('society-email').value = '';

        loadSocieties();

    } catch (error) {
        console.error('Error adding society:', error);
        alert('Error adding society: ' + error.message);
    } finally {
        const btn = document.querySelector('.btn-add');
        btn.disabled = false;
        btn.textContent = 'Add Society';
    }
}

// Delete society
async function deleteSociety(societyId) {
    if (!confirm('Are you sure you want to delete this society? This cannot be undone.')) return;

    try {
        await db.collection('societies').doc(societyId).delete();
        loadSocieties();
    } catch (error) {
        console.error('Error deleting society:', error);
        alert('Error deleting society: ' + error.message);
    }
}

// Load data
loadSocieties();