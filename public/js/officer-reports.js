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
let allSocieties = [];
let allUsers = [];

// --- Report 1 (Budget Request Status) ---
let filteredRequests = [];
let p1CurrentPage = 1;
const p1ItemsPerPage = 5;

// --- Report 3 (Financial Allocation) ---
let filteredApprovedRequests = [];
let p3CurrentPage = 1;
const p3ItemsPerPage = 5;

// --- Report 4 (Incorrect Submission) ---
let filteredFlaggedRequests = [];
let p4CurrentPage = 1;
const p4ItemsPerPage = 5;

// Status colors for badges
const statusBadgeMap = {
    'Submitted': 'pending',
    'Under Review': 'pending',
    'Approved': 'approved',
    'Rejected': 'rejected',
    'Revision Required': 'pending'
};

// ============ FILTER FUNCTIONS (Report 1) ============

function toggleFilterInputs() {
    const filterType = document.querySelector('input[name="filterType"]:checked').value;
    document.getElementById('monthFilter').style.display = filterType === 'month' ? 'flex' : 'none';
    document.getElementById('rangeFilter').style.display = filterType === 'range' ? 'flex' : 'none';
}

function computeFilteredRequests() {
    const filterType = document.querySelector('input[name="filterType"]:checked').value;
    let dateFiltered = [];
    let titleSuffix = '';

    if (filterType === 'month') {
        const month = document.getElementById('filterMonth').value;
        const year = document.getElementById('filterYear').value;

        dateFiltered = allRequests.filter(item => {
            if (!item.submittedAt) return false;
            const date = new Date(item.submittedAt.seconds * 1000);
            return date.getMonth() === (parseInt(month) - 1) && date.getFullYear() === parseInt(year);
        });

        const monthName = document.getElementById('filterMonth').selectedOptions[0].text;
        titleSuffix = ` for the month of ${monthName} ${year}`;
    } else {
        const start = document.getElementById('startDate').value;
        const end = document.getElementById('endDate').value;

        if (!start || !end) {
            showToast('Please select both start and end dates.');
            return;
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        dateFiltered = allRequests.filter(item => {
            if (!item.submittedAt) return false;
            const date = new Date(item.submittedAt.seconds * 1000);
            return date >= startDate && date <= endDate;
        });

        titleSuffix = ` from ${start} to ${end}`;
    }

    const status = document.getElementById('p1-status-filter').value;
    const societyQuery = document.getElementById('p1-society-search').value.trim().toLowerCase();

    let filtered = dateFiltered;
    if (status !== 'All') {
        filtered = filtered.filter(r => r.status === status);
    }
    if (societyQuery !== '') {
        filtered = filtered.filter(r => (r.societyName || '').toLowerCase().includes(societyQuery));
    }

    filteredRequests = filtered;

    let title = 'Budget Request Status Report';
    if (titleSuffix) {
        title += titleSuffix;
    }
    if (status !== 'All') {
        title += ` (Status: ${status})`;
    }
    if (societyQuery !== '') {
        const originalQuery = document.getElementById('p1-society-search').value.trim();
        title += ` (Society: ${originalQuery})`;
    }
    document.getElementById('p1-title').textContent = title;

    p1CurrentPage = 1;
    renderReport1();
}

function applyDefaultFilter() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    document.getElementById('filterMonth').value = month;
    document.getElementById('filterYear').value = year;
    document.querySelector('input[name="filterType"][value="month"]').checked = true;
    toggleFilterInputs();

    document.getElementById('p1-status-filter').value = 'All';
    document.getElementById('p1-society-search').value = '';

    computeFilteredRequests();
}

function applyFilter() {
    computeFilteredRequests();
}

function clearFilter() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    document.getElementById('filterMonth').value = month;
    document.getElementById('filterYear').value = year;
    document.querySelector('input[name="filterType"][value="month"]').checked = true;
    toggleFilterInputs();

    document.getElementById('p1-status-filter').value = 'All';
    document.getElementById('p1-society-search').value = '';

    computeFilteredRequests();
    showToast('Filter cleared — showing current month with all statuses.');
}

// ============ FILTER FUNCTIONS (Report 2) ============

function applyFilterP2() {
    renderReport2();
}

function clearFilterP2() {
    document.getElementById('p2-status-filter').value = 'All';
    renderReport2();
    showToast('Filter cleared — showing all societies.');
}

// ============ FILTER FUNCTIONS (Report 3) ============

function toggleFilterInputsP3() {
    const filterType = document.querySelector('input[name="filterTypeP3"]:checked').value;
    document.getElementById('monthFilterP3').style.display = filterType === 'month' ? 'flex' : 'none';
    document.getElementById('rangeFilterP3').style.display = filterType === 'range' ? 'flex' : 'none';
}

function applyDefaultFilterP3() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    document.getElementById('filterMonthP3').value = month;
    document.getElementById('filterYearP3').value = year;
    document.querySelector('input[name="filterTypeP3"][value="month"]').checked = true;
    toggleFilterInputsP3();

    filteredApprovedRequests = allRequests.filter(item => {
        if (item.status !== 'Approved') return false;
        if (!item.submittedAt) return false;
        const date = new Date(item.submittedAt.seconds * 1000);
        return date.getMonth() === (parseInt(month) - 1) && date.getFullYear() === parseInt(year);
    });

    const monthName = document.getElementById('filterMonthP3').selectedOptions[0].text;
    document.getElementById('p3-title').textContent = `Financial Allocation Report — ${monthName} ${year}`;
    p3CurrentPage = 1;
}

function applyFilterP3() {
    const filterType = document.querySelector('input[name="filterTypeP3"]:checked').value;

    if (filterType === 'month') {
        const month = document.getElementById('filterMonthP3').value;
        const year = document.getElementById('filterYearP3').value;

        filteredApprovedRequests = allRequests.filter(item => {
            if (item.status !== 'Approved') return false;
            if (!item.submittedAt) return false;
            const date = new Date(item.submittedAt.seconds * 1000);
            return date.getMonth() === (parseInt(month) - 1) && date.getFullYear() === parseInt(year);
        });

        const monthName = document.getElementById('filterMonthP3').selectedOptions[0].text;
        document.getElementById('p3-title').textContent = `Financial Allocation Report — ${monthName} ${year}`;
    } else {
        const start = document.getElementById('startDateP3').value;
        const end = document.getElementById('endDateP3').value;

        if (!start || !end) {
            showToast('Please select both start and end dates.');
            return;
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        filteredApprovedRequests = allRequests.filter(item => {
            if (item.status !== 'Approved') return false;
            if (!item.submittedAt) return false;
            const date = new Date(item.submittedAt.seconds * 1000);
            return date >= startDate && date <= endDate;
        });

        document.getElementById('p3-title').textContent = `Financial Allocation Report — ${start} to ${end}`;
    }

    p3CurrentPage = 1;
    renderReport3();
}

function clearFilterP3() {
    applyDefaultFilterP3();
    renderReport3();
    showToast('Filter cleared — showing current month.');
}

// ============ FILTER FUNCTIONS (Report 4) ============

function toggleFilterInputsP4() {
    const filterType = document.querySelector('input[name="filterTypeP4"]:checked').value;
    document.getElementById('monthFilterP4').style.display = filterType === 'month' ? 'flex' : 'none';
    document.getElementById('rangeFilterP4').style.display = filterType === 'range' ? 'flex' : 'none';
}

function applyDefaultFilterP4() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    document.getElementById('filterMonthP4').value = month;
    document.getElementById('filterYearP4').value = year;
    document.querySelector('input[name="filterTypeP4"][value="month"]').checked = true;
    toggleFilterInputsP4();

    filteredFlaggedRequests = allRequests.filter(item => {
        if (item.status !== 'Revision Required') return false;
        if (!item.submittedAt) return false;
        const date = new Date(item.submittedAt.seconds * 1000);
        return date.getMonth() === (parseInt(month) - 1) && date.getFullYear() === parseInt(year);
    });

    const monthName = document.getElementById('filterMonthP4').selectedOptions[0].text;
    document.getElementById('p4-title').textContent = `Incorrect Submission Report — ${monthName} ${year}`;
    p4CurrentPage = 1;
}

function applyFilterP4() {
    const filterType = document.querySelector('input[name="filterTypeP4"]:checked').value;

    if (filterType === 'month') {
        const month = document.getElementById('filterMonthP4').value;
        const year = document.getElementById('filterYearP4').value;

        filteredFlaggedRequests = allRequests.filter(item => {
            if (item.status !== 'Revision Required') return false;
            if (!item.submittedAt) return false;
            const date = new Date(item.submittedAt.seconds * 1000);
            return date.getMonth() === (parseInt(month) - 1) && date.getFullYear() === parseInt(year);
        });

        const monthName = document.getElementById('filterMonthP4').selectedOptions[0].text;
        document.getElementById('p4-title').textContent = `Incorrect Submission Report — ${monthName} ${year}`;
    } else {
        const start = document.getElementById('startDateP4').value;
        const end = document.getElementById('endDateP4').value;

        if (!start || !end) {
            showToast('Please select both start and end dates.');
            return;
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        filteredFlaggedRequests = allRequests.filter(item => {
            if (item.status !== 'Revision Required') return false;
            if (!item.submittedAt) return false;
            const date = new Date(item.submittedAt.seconds * 1000);
            return date >= startDate && date <= endDate;
        });

        document.getElementById('p4-title').textContent = `Incorrect Submission Report — ${start} to ${end}`;
    }

    p4CurrentPage = 1;
    renderReport4();
}

function clearFilterP4() {
    applyDefaultFilterP4();
    renderReport4();
    showToast('Filter cleared — showing current month.');
}

// ============ LOAD DATA ============
async function loadAllData() {
    try {
        const requestsSnapshot = await db.collection('requests').get();
        allRequests = [];
        requestsSnapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
        });

        const societiesSnapshot = await db.collection('societies').get();
        allSocieties = [];
        societiesSnapshot.forEach(doc => {
            allSocieties.push({ id: doc.id, ...doc.data() });
        });

        const usersSnapshot = await db.collection('users').get();
        allUsers = [];
        usersSnapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        document.getElementById('last-updated').textContent = 'Data as of ' + new Date().toLocaleString();

        // --- Report 1: Default current month ---
        applyDefaultFilter();

        // --- Report 3: Default current month (now matches Report 1 & 4) ---
        applyDefaultFilterP3();

        // --- Report 4: Default current month ---
        applyDefaultFilterP4();

        // Render all reports
        renderReport1();
        renderReport2();
        renderReport3();
        renderReport4();

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ============ REPORT 1: BUDGET REQUEST STATUS (with Pagination) ============
function renderReport1() {
    const total = filteredRequests.length;
    const approved = filteredRequests.filter(r => r.status === 'Approved').length;
    const review = filteredRequests.filter(r => r.status === 'Under Review' || r.status === 'Submitted').length;
    const rejected = filteredRequests.filter(r => r.status === 'Rejected').length;

    document.getElementById('p1-total').textContent = total;
    document.getElementById('p1-approved').textContent = approved;
    document.getElementById('p1-review').textContent = review;
    document.getElementById('p1-rejected').textContent = rejected;
    document.getElementById('p1-approval-rate').textContent = total > 0 ? Math.round((approved/total)*100) + '% approval rate' : 'No data';
    document.getElementById('p1-rejection-rate').textContent = total > 0 ? Math.round((rejected/total)*100) + '% rejection rate' : 'No data';
    document.getElementById('p1-avg-pending').textContent = total > 0 ? 'Avg. pending' : 'No data';

    const status = document.getElementById('p1-status-filter').value;
    const statsDiv = document.getElementById('p1-stats');
    const chartCard = document.getElementById('p1-chart-card');
    if (status === 'All') {
        statsDiv.style.display = '';
        chartCard.style.display = '';
    } else {
        statsDiv.style.display = 'none';
        chartCard.style.display = 'none';
    }

    const chartData = [];
    if (approved > 0) chartData.push({ label: 'Approved', count: approved, color: '#1E8E5A' });
    if (review > 0) chartData.push({ label: 'Under Review', count: review, color: '#2E6FBA' });
    if (rejected > 0) chartData.push({ label: 'Rejected', count: rejected, color: '#C0392B' });
    
    if (chartData.length === 0) {
        document.getElementById('p1-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No data available for this period</p>';
    } else {
        renderChart('p1-chart', chartData);
    }

    const tbody = document.getElementById('p1-table-body');
    const sorted = [...filteredRequests].sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / p1ItemsPerPage);

    if (p1CurrentPage > totalPages) p1CurrentPage = totalPages || 1;
    if (p1CurrentPage < 1) p1CurrentPage = 1;

    const start = (p1CurrentPage - 1) * p1ItemsPerPage;
    const end = Math.min(start + p1ItemsPerPage, totalItems);
    const pageItems = sorted.slice(start, end);

    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#6c757d;">No requests submitted for this period</td></tr>`;
    } else {
        tbody.innerHTML = pageItems.map(r => `
            <tr>
                <td class="strong">REQ-${String(r.id).slice(0, 8)}</td>
                <td>${r.societyName || 'Unknown'}</td>
                <td>${r.type || 'N/A'}</td>
                <td>R ${r.amount ? r.amount.toLocaleString() : '0'}</td>
                <td>${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td><span class="badge ${statusBadgeMap[r.status] || 'pending'}"><span class="dot"></span>${r.status || 'N/A'}</span></td>
            </tr>
        `).join('');
    }

    document.getElementById('p1-showing').textContent = `Showing ${totalItems > 0 ? start + 1 : 0}-${end} of ${totalItems} requests`;
    document.getElementById('p1-page-info').textContent = `Page ${p1CurrentPage} of ${totalPages || 1}`;
    document.getElementById('p1-prev-btn').disabled = (p1CurrentPage <= 1);
    document.getElementById('p1-next-btn').disabled = (p1CurrentPage >= totalPages);
}

function changePageP1(delta) {
    p1CurrentPage += delta;
    renderReport1();
}

// ============ REPORT 2: SOCIETY ACTIVITY (with Active/Dormant Filter) ============
function renderReport2() {
    const statusFilter = document.getElementById('p2-status-filter').value;

    // Build enriched society data with request counts
    let societyData = allSocieties.map(s => {
        const requests = allRequests.filter(r => r.societyName === s.name);
        const eventReqs = requests.filter(r => r.type === 'Event').length;
        const regaliaReqs = requests.filter(r => r.type === 'Regalia').length;
        const lastActive = requests.length > 0 ? 
            new Date(Math.max(...requests.map(r => r.submittedAt ? r.submittedAt.seconds : 0)) * 1000).toLocaleDateString() :
            'Never';
        return {
            ...s,
            requests,
            eventReqs,
            regaliaReqs,
            totalReqs: requests.length,
            lastActive
        };
    });

    // Apply filter
    let filteredData = societyData;
    if (statusFilter === 'Active') {
        filteredData = filteredData.filter(s => s.totalReqs > 0);
    } else if (statusFilter === 'Dormant') {
        filteredData = filteredData.filter(s => s.totalReqs === 0);
    }

    // Calculate stats based on filtered data
    const totalSocieties = filteredData.length;
    const totalRequests = filteredData.reduce((sum, s) => sum + s.totalReqs, 0);
    const eventTotal = filteredData.reduce((sum, s) => sum + s.eventReqs, 0);
    const regaliaTotal = filteredData.reduce((sum, s) => sum + s.regaliaReqs, 0);
    const avgRequests = totalSocieties > 0 ? (totalRequests / totalSocieties) : 0;

    // Active count for the original "All" view context (how many have requests)
    const activeCount = societyData.filter(s => s.totalReqs > 0).length;
    const dormantCount = societyData.filter(s => s.totalReqs === 0).length;

    // Update stats cards dynamically based on filter
    const label1 = document.getElementById('p2-label-1');
    const value1 = document.getElementById('p2-total');
    const delta1 = document.getElementById('p2-delta-1');

    const label2 = document.getElementById('p2-label-2');
    const value2 = document.getElementById('p2-active');
    const delta2 = document.getElementById('p2-delta-2');

    const label3 = document.getElementById('p2-label-3');
    const value3 = document.getElementById('p2-dormant');
    const delta3 = document.getElementById('p2-delta-3');

    const label4 = document.getElementById('p2-label-4');
    const value4 = document.getElementById('p2-split');
    const delta4 = document.getElementById('p2-delta-4');

    if (statusFilter === 'All') {
        label1.textContent = 'Registered Societies';
        value1.textContent = totalSocieties;
        delta1.textContent = 'As of today';

        label2.textContent = 'Active';
        value2.textContent = activeCount;
        delta2.textContent = 'Have requests';

        label3.textContent = 'Dormant';
        value3.textContent = dormantCount;
        delta3.textContent = 'No requests';

        label4.textContent = 'Event : Regalia Split';
        value4.textContent = `${eventTotal} : ${regaliaTotal}`;
        delta4.textContent = 'Total requests';
    } else if (statusFilter === 'Active') {
        label1.textContent = 'Active Societies';
        value1.textContent = totalSocieties;
        delta1.textContent = 'Engaged this period';

        label2.textContent = 'Total Requests';
        value2.textContent = totalRequests;
        delta2.textContent = 'From active societies';

        label3.textContent = 'Avg Requests / Society';
        value3.textContent = avgRequests.toFixed(1);
        delta3.textContent = 'Per society';

        label4.textContent = 'Event : Regalia Split';
        value4.textContent = `${eventTotal} : ${regaliaTotal}`;
        delta4.textContent = 'Active only';
    } else { // Dormant
        label1.textContent = 'Dormant Societies';
        value1.textContent = totalSocieties;
        delta1.textContent = 'Inactive this period';

        label2.textContent = 'Total Requests';
        value2.textContent = '0';
        delta2.textContent = 'No activity';

        label3.textContent = 'Avg Requests / Society';
        value3.textContent = '0.0';
        delta3.textContent = 'N/A';

        label4.textContent = 'Event : Regalia Split';
        value4.textContent = '0 : 0';
        delta4.textContent = 'No requests';
    }

    // --- Chart ---
    const chartContainer = document.getElementById('p2-chart');
    const sortedForChart = [...filteredData].sort((a, b) => b.totalReqs - a.totalReqs).slice(0, 5);

    if (statusFilter === 'Dormant' || sortedForChart.every(s => s.totalReqs === 0)) {
        chartContainer.innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No active societies to display</p>';
    } else {
        const chartData = sortedForChart.filter(s => s.totalReqs > 0).map(s => ({
            label: s.name,
            count: s.totalReqs,
            color: '#2E6FBA'
        }));
        renderChart('p2-chart', chartData);
    }

    // --- Table ---
    const tbody = document.getElementById('p2-table-body');
    const sortedForTable = [...filteredData].sort((a, b) => b.totalReqs - a.totalReqs);
    const display = sortedForTable.slice(0, 8);

    if (display.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#6c757d;">No societies match this filter</td></tr>`;
    } else {
        tbody.innerHTML = display.map(s => `
            <tr>
                <td class="strong">${s.name}</td>
                <td>${s.category || 'General'}</td>
                <td>${s.eventReqs}</td>
                <td>${s.regaliaReqs}</td>
                <td>${s.totalReqs}</td>
                <td>${s.lastActive}</td>
                <td><span class="badge ${s.totalReqs > 0 ? 'active' : 'dormant'}"><span class="dot"></span>${s.totalReqs > 0 ? 'Active' : 'Dormant'}</span></td>
            </tr>
        `).join('');
    }

    document.getElementById('p2-showing').textContent = `Showing ${display.length} of ${filteredData.length} societies`;
}

// ============ REPORT 3: FINANCIAL ALLOCATION ============
function renderReport3() {
    const approved = filteredApprovedRequests;
    const totalApproved = approved.reduce((sum, r) => sum + (r.amount || 0), 0);
    const eventTotal = approved.filter(r => r.type === 'Event').reduce((sum, r) => sum + (r.amount || 0), 0);
    const regaliaTotal = approved.filter(r => r.type === 'Regalia').reduce((sum, r) => sum + (r.amount || 0), 0);
    const otherTotal = approved.filter(r => r.type !== 'Event' && r.type !== 'Regalia').reduce((sum, r) => sum + (r.amount || 0), 0);

    document.getElementById('p3-total').textContent = totalApproved > 0 ? 'R ' + totalApproved.toLocaleString() : 'R 0';
    document.getElementById('p3-events').textContent = eventTotal > 0 ? 'R ' + eventTotal.toLocaleString() : 'R 0';
    document.getElementById('p3-regalia').textContent = regaliaTotal > 0 ? 'R ' + regaliaTotal.toLocaleString() : 'R 0';
    document.getElementById('p3-other').textContent = otherTotal > 0 ? 'R ' + otherTotal.toLocaleString() : 'R 0';

    document.getElementById('p3-events-pct').textContent = totalApproved > 0 ? Math.round((eventTotal/totalApproved)*100) + '% of total' : '0%';
    document.getElementById('p3-regalia-pct').textContent = totalApproved > 0 ? Math.round((regaliaTotal/totalApproved)*100) + '% of total' : '0%';
    document.getElementById('p3-other-pct').textContent = totalApproved > 0 ? Math.round((otherTotal/totalApproved)*100) + '% of total' : '0%';

    const chartData = [];
    if (eventTotal > 0) chartData.push({ label: 'Events', count: eventTotal, color: '#1B3E73' });
    if (regaliaTotal > 0) chartData.push({ label: 'Regalia', count: regaliaTotal, color: '#2E6FBA' });
    if (otherTotal > 0) chartData.push({ label: 'Other', count: otherTotal, color: '#3E7CB1' });
    
    if (chartData.length === 0) {
        document.getElementById('p3-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No approved requests for this period</p>';
    } else {
        renderChart('p3-chart', chartData);
    }

    const tbody = document.getElementById('p3-table-body');
    const sorted = [...approved].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / p3ItemsPerPage);

    if (p3CurrentPage > totalPages) p3CurrentPage = totalPages || 1;
    if (p3CurrentPage < 1) p3CurrentPage = 1;

    const start = (p3CurrentPage - 1) * p3ItemsPerPage;
    const end = Math.min(start + p3ItemsPerPage, totalItems);
    const pageItems = sorted.slice(start, end);

    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#6c757d;">No approved requests found</td></tr>`;
    } else {
        tbody.innerHTML = pageItems.map(r => `
            <tr>
                <td class="strong">${r.societyName || 'Unknown'}</td>
                <td>${r.type || 'N/A'}</td>
                <td>R ${r.amount ? r.amount.toLocaleString() : '0'}</td>
                <td>${totalApproved > 0 ? Math.round(((r.amount || 0)/totalApproved)*100) : 0}%</td>
                <td><span class="badge ${r.amount && r.amount > 10000 ? 'full' : 'partial'}"><span class="dot"></span>${r.amount && r.amount > 10000 ? 'Fully Allocated' : 'Partially Allocated'}</span></td>
            </tr>
        `).join('');
    }

    document.getElementById('p3-showing').textContent = `Showing ${totalItems > 0 ? start + 1 : 0}-${end} of ${totalItems} approved requests`;
    document.getElementById('p3-page-info').textContent = `Page ${p3CurrentPage} of ${totalPages || 1}`;
    document.getElementById('p3-prev-btn').disabled = (p3CurrentPage <= 1);
    document.getElementById('p3-next-btn').disabled = (p3CurrentPage >= totalPages);
}

function changePageP3(delta) {
    p3CurrentPage += delta;
    renderReport3();
}

// ============ REPORT 4: INCORRECT SUBMISSION (with Filter + Pagination) ============
function renderReport4() {
    const flagged = filteredFlaggedRequests;
    const total = flagged.length;

    document.getElementById('p4-total').textContent = total;
    document.getElementById('p4-top-issue').textContent = total > 0 ? 'Revision Required' : 'None';
    document.getElementById('p4-top-count').textContent = total > 0 ? total + ' requests' : 'No flagged requests';
    document.getElementById('p4-awaiting').textContent = total;
    document.getElementById('p4-resolved').textContent = '0';
    document.getElementById('p4-flag-rate').textContent = allRequests.length > 0 ? Math.round((total/allRequests.length)*100) + '% of all requests' : '0%';
    document.getElementById('p4-resolved-rate').textContent = '0% resolved';
    document.getElementById('p4-avg-open').textContent = total > 0 ? 'Awaiting review' : 'No data';

    if (total === 0) {
        document.getElementById('p4-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No flagged submissions for this period</p>';
    } else {
        const chartData = [
            { label: 'Needs Revision', count: total, color: '#B9720B' }
        ];
        renderChart('p4-chart', chartData);
    }

    const tbody = document.getElementById('p4-table-body');
    const sorted = [...flagged].sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / p4ItemsPerPage);

    if (p4CurrentPage > totalPages) p4CurrentPage = totalPages || 1;
    if (p4CurrentPage < 1) p4CurrentPage = 1;

    const start = (p4CurrentPage - 1) * p4ItemsPerPage;
    const end = Math.min(start + p4ItemsPerPage, totalItems);
    const pageItems = sorted.slice(start, end);

    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#6c757d;">No flagged submissions for this period</td></tr>`;
    } else {
        tbody.innerHTML = pageItems.map(r => `
            <tr>
                <td class="strong">REQ-${String(r.id).slice(0, 8)}</td>
                <td>${r.societyName || 'Unknown'}</td>
                <td>Requires revision - ${r.status}</td>
                <td>${r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td>Review and resubmit</td>
                <td><span class="badge await"><span class="dot"></span>Awaiting Resubmission</span></td>
            </tr>
        `).join('');
    }

    document.getElementById('p4-showing').textContent = `Showing ${totalItems > 0 ? start + 1 : 0}-${end} of ${totalItems} flagged submissions`;
    document.getElementById('p4-page-info').textContent = `Page ${p4CurrentPage} of ${totalPages || 1}`;
    document.getElementById('p4-prev-btn').disabled = (p4CurrentPage <= 1);
    document.getElementById('p4-next-btn').disabled = (p4CurrentPage >= totalPages);
}

function changePageP4(delta) {
    p4CurrentPage += delta;
    renderReport4();
}

// ============ CHART RENDERER ============
function renderChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const max = Math.max(...data.map(d => d.count), 1);
    container.innerHTML = data.map(d => `
        <div class="bar-row">
            <div class="bar-label">${d.label}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${Math.round((d.count/max)*100)}%;background:${d.color};"></div>
            </div>
            <div class="bar-value">${d.count}</div>
        </div>
    `).join('');
}

// ============ EXPORT FUNCTIONS ============

function exportCSV(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const table = panel.querySelector('table');
    if (!table) {
        alert('No data to export.');
        return;
    }

    const headers = [];
    const rows = [];
    
    const thead = table.querySelector('thead');
    if (thead) {
        const headerCells = thead.querySelectorAll('th');
        headerCells.forEach(th => {
            headers.push(th.textContent.trim());
        });
    }

    const tbody = table.querySelector('tbody');
    if (tbody) {
        const trs = tbody.querySelectorAll('tr');
        trs.forEach(tr => {
            const rowData = [];
            const tds = tr.querySelectorAll('td');
            tds.forEach(td => {
                const text = td.textContent.trim();
                rowData.push(text);
            });
            if (rowData.length > 0) {
                rows.push(rowData);
            }
        });
    }

    if (rows.length === 0) {
        alert('No data to export.');
        return;
    }

    let csvContent = '';
    if (headers.length > 0) {
        csvContent += headers.join(',') + '\n';
    }

    rows.forEach(row => {
        const escapedRow = row.map(cell => {
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        });
        csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${panelId}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('CSV exported successfully!');
}

function exportPDF(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) {
        alert('No data to export.');
        return;
    }

    if (typeof window.jspdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = function() {
            const script2 = document.createElement('script');
            script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script2.onload = function() {
                generatePDF(panel, panelId);
            };
            document.head.appendChild(script2);
        };
        document.head.appendChild(script);
        showToast('Loading PDF library...');
        return;
    }

    generatePDF(panel, panelId);
}

function generatePDF(panel, panelId) {
    const { jsPDF } = window.jspdf;
    
    const clone = panel.cloneNode(true);
    const actions = clone.querySelector('.report-actions');
    if (actions) actions.remove();

    clone.style.padding = '20px';
    clone.style.background = '#FFFFFF';
    clone.style.borderRadius = '0';
    clone.style.display = 'block';
    clone.style.maxWidth = '100%';
    
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.style.background = '#FFFFFF';
    container.style.padding = '40px';
    container.appendChild(clone);
    document.body.appendChild(container);

    const titleDiv = document.createElement('div');
    titleDiv.style.textAlign = 'center';
    titleDiv.style.marginBottom = '20px';
    titleDiv.style.fontFamily = 'Space Grotesk, sans-serif';
    titleDiv.style.fontSize = '24px';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.color = '#0B1F3A';
    titleDiv.textContent = document.querySelector('.report-head h2')?.textContent || 'Report';
    clone.prepend(titleDiv);

    const dateDiv = document.createElement('div');
    dateDiv.style.textAlign = 'center';
    dateDiv.style.marginBottom = '20px';
    dateDiv.style.fontSize = '12px';
    dateDiv.style.color = '#5A6B87';
    dateDiv.textContent = `Generated: ${new Date().toLocaleString()}`;
    clone.prepend(dateDiv);

    const brandDiv = document.createElement('div');
    brandDiv.style.textAlign = 'center';
    brandDiv.style.marginBottom = '30px';
    brandDiv.style.fontSize = '14px';
    brandDiv.style.fontWeight = '600';
    brandDiv.style.color = '#0B1F3A';
    brandDiv.style.letterSpacing = '0.06em';
    brandDiv.style.textTransform = 'uppercase';
    brandDiv.textContent = 'University of the Witwatersrand - SGO Digital Operations';
    clone.prepend(brandDiv);

    html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: 1200,
        backgroundColor: '#FFFFFF'
    }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();

        while (heightLeft > 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();
        }

        pdf.save(`report_${panelId}_${new Date().toISOString().slice(0,10)}.pdf`);
        document.body.removeChild(container);
        showToast('PDF exported successfully!');
    }).catch((error) => {
        console.error('PDF generation error:', error);
        document.body.removeChild(container);
        alert('Error generating PDF. Try again.');
    });
}

// ============ TOAST NOTIFICATION ============
function showToast(message) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.background = '#0B1F3A';
    toast.style.color = '#fff';
    toast.style.padding = '14px 24px';
    toast.style.borderRadius = '8px';
    toast.style.fontFamily = 'Inter, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.boxShadow = '0 4px 16px rgba(11, 31, 58, 0.3)';
    toast.style.zIndex = '9999';
    toast.style.animation = 'fadeIn 0.3s ease';
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3000);
}

// ============ TAB SWITCHING ============
document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', function() {
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(this.dataset.target).classList.add('active');
    });
});

// ============ INITIALIZE ============
document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
});