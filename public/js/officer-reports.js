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

// Status colors for badges
const statusBadgeMap = {
    'Submitted': 'pending',
    'Under Review': 'pending',
    'Approved': 'approved',
    'Rejected': 'rejected',
    'Revision Required': 'pending'
};

// ============ LOAD DATA ============
async function loadAllData() {
    try {
        // Load requests
        const requestsSnapshot = await db.collection('requests').get();
        allRequests = [];
        requestsSnapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
        });

        // Load societies
        const societiesSnapshot = await db.collection('societies').get();
        allSocieties = [];
        societiesSnapshot.forEach(doc => {
            allSocieties.push({ id: doc.id, ...doc.data() });
        });

        // Load users
        const usersSnapshot = await db.collection('users').get();
        allUsers = [];
        usersSnapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        // Update last updated time
        document.getElementById('last-updated').textContent = 'Data as of ' + new Date().toLocaleString();

        // Render all reports
        renderReport1();
        renderReport2();
        renderReport3();
        renderReport4();

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ============ REPORT 1: BUDGET REQUEST STATUS ============
function renderReport1() {
    const total = allRequests.length;
    const approved = allRequests.filter(r => r.status === 'Approved').length;
    const review = allRequests.filter(r => r.status === 'Under Review' || r.status === 'Submitted').length;
    const rejected = allRequests.filter(r => r.status === 'Rejected').length;

    // Stats
    document.getElementById('p1-total').textContent = total;
    document.getElementById('p1-approved').textContent = approved;
    document.getElementById('p1-review').textContent = review;
    document.getElementById('p1-rejected').textContent = rejected;
    document.getElementById('p1-approval-rate').textContent = total > 0 ? Math.round((approved/total)*100) + '% approval rate' : 'No data';
    document.getElementById('p1-rejection-rate').textContent = total > 0 ? Math.round((rejected/total)*100) + '% rejection rate' : 'No data';
    document.getElementById('p1-avg-pending').textContent = total > 0 ? 'Avg. pending' : 'No data';

    // Chart
    const chartData = [];
    if (approved > 0) chartData.push({ label: 'Approved', count: approved, color: '#1E8E5A' });
    if (review > 0) chartData.push({ label: 'Under Review', count: review, color: '#2E6FBA' });
    if (rejected > 0) chartData.push({ label: 'Rejected', count: rejected, color: '#C0392B' });
    
    if (chartData.length === 0) {
        document.getElementById('p1-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No data available</p>';
    } else {
        renderChart('p1-chart', chartData);
    }

    // Table
    const tbody = document.getElementById('p1-table-body');
    const sorted = [...allRequests].sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    const display = sorted.slice(0, 10);
    
    if (display.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#6c757d;">No requests submitted yet</td></tr>`;
    } else {
        tbody.innerHTML = display.map(r => `
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
    document.getElementById('p1-showing').textContent = `Showing ${Math.min(display.length, total)} of ${total} requests`;
}

// ============ REPORT 2: SOCIETY ACTIVITY ============
function renderReport2() {
    const total = allSocieties.length;
    const active = allSocieties.filter(s => {
        const hasRequests = allRequests.some(r => r.societyName === s.name);
        return hasRequests;
    });
    const dormant = allSocieties.filter(s => {
        const hasRequests = allRequests.some(r => r.societyName === s.name);
        return !hasRequests;
    });

    const eventCount = allRequests.filter(r => r.type === 'Event').length;
    const regaliaCount = allRequests.filter(r => r.type === 'Regalia').length;

    document.getElementById('p2-total').textContent = total || '0';
    document.getElementById('p2-active').textContent = active.length || '0';
    document.getElementById('p2-dormant').textContent = dormant.length || '0';
    document.getElementById('p2-engagement').textContent = total > 0 ? Math.round((active.length/total)*100) + '% engagement' : 'No societies';
    document.getElementById('p2-dormant-rate').textContent = total > 0 ? Math.round((dormant.length/total)*100) + '% dormant' : 'No societies';
    document.getElementById('p2-split').textContent = `${eventCount || 0} : ${regaliaCount || 0}`;

    // Chart - Top active societies
    const societyActivity = allSocieties.map(s => {
        const requests = allRequests.filter(r => r.societyName === s.name);
        return { name: s.name, count: requests.length };
    }).sort((a, b) => b.count - a.count).slice(0, 5);

    if (societyActivity.length === 0 || societyActivity.every(s => s.count === 0)) {
        document.getElementById('p2-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No activity data available</p>';
    } else {
        const chartData = societyActivity.filter(s => s.count > 0).map(s => ({
            label: s.name,
            count: s.count,
            color: '#2E6FBA'
        }));
        if (chartData.length === 0) {
            document.getElementById('p2-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No active societies</p>';
        } else {
            renderChart('p2-chart', chartData);
        }
    }

    // Table
    const tbody = document.getElementById('p2-table-body');
    const sorted = allSocieties.map(s => {
        const requests = allRequests.filter(r => r.societyName === s.name);
        const eventReqs = requests.filter(r => r.type === 'Event').length;
        const regaliaReqs = requests.filter(r => r.type === 'Regalia').length;
        const lastActive = requests.length > 0 ? 
            new Date(Math.max(...requests.map(r => r.submittedAt ? r.submittedAt.seconds : 0)) * 1000).toLocaleDateString() :
            'Never';
        return { ...s, requests, eventReqs, regaliaReqs, totalReqs: requests.length, lastActive };
    }).sort((a, b) => b.totalReqs - a.totalReqs);

    const display = sorted.slice(0, 8);
    
    if (display.length === 0 || display.every(s => s.totalReqs === 0)) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#6c757d;">No societies registered yet</td></tr>`;
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
    document.getElementById('p2-showing').textContent = `Showing ${Math.min(display.length, sorted.length)} of ${sorted.length} societies`;
}

// ============ REPORT 3: FINANCIAL ALLOCATION ============
function renderReport3() {
    const approved = allRequests.filter(r => r.status === 'Approved');
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

    // Chart
    const chartData = [];
    if (eventTotal > 0) chartData.push({ label: 'Events', count: eventTotal, color: '#1B3E73' });
    if (regaliaTotal > 0) chartData.push({ label: 'Regalia', count: regaliaTotal, color: '#2E6FBA' });
    if (otherTotal > 0) chartData.push({ label: 'Other', count: otherTotal, color: '#3E7CB1' });
    
    if (chartData.length === 0) {
        document.getElementById('p3-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No approved requests</p>';
    } else {
        renderChart('p3-chart', chartData);
    }

    // Table
    const tbody = document.getElementById('p3-table-body');
    const sorted = approved.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const display = sorted.slice(0, 7);
    
    if (display.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#6c757d;">No approved requests yet</td></tr>`;
    } else {
        tbody.innerHTML = display.map(r => `
            <tr>
                <td class="strong">${r.societyName || 'Unknown'}</td>
                <td>${r.type || 'N/A'}</td>
                <td>R ${r.amount ? r.amount.toLocaleString() : '0'}</td>
                <td>${totalApproved > 0 ? Math.round(((r.amount || 0)/totalApproved)*100) : 0}%</td>
                <td><span class="badge ${r.amount && r.amount > 10000 ? 'full' : 'partial'}"><span class="dot"></span>${r.amount && r.amount > 10000 ? 'Fully Allocated' : 'Partially Allocated'}</span></td>
            </tr>
        `).join('');
    }
    document.getElementById('p3-showing').textContent = `Showing ${Math.min(display.length, sorted.length)} of ${sorted.length} approved requests`;
}

// ============ REPORT 4: INCORRECT SUBMISSION ============
function renderReport4() {
    // Only show requests with status 'Revision Required' as flagged
    const flagged = allRequests.filter(r => r.status === 'Revision Required');
    const total = flagged.length;

    document.getElementById('p4-total').textContent = total;
    document.getElementById('p4-top-issue').textContent = total > 0 ? 'Revision Required' : 'None';
    document.getElementById('p4-top-count').textContent = total > 0 ? total + ' requests' : 'No flagged requests';
    document.getElementById('p4-awaiting').textContent = total;
    document.getElementById('p4-resolved').textContent = '0';
    document.getElementById('p4-flag-rate').textContent = allRequests.length > 0 ? Math.round((total/allRequests.length)*100) + '% of all requests' : '0%';
    document.getElementById('p4-resolved-rate').textContent = '0% resolved';
    document.getElementById('p4-avg-open').textContent = total > 0 ? 'Awaiting review' : 'No data';

    // Chart - show status distribution of flagged items
    if (total === 0) {
        document.getElementById('p4-chart').innerHTML = '<p style="color:#6c757d;font-size:14px;text-align:center;padding:20px 0;">No flagged submissions</p>';
    } else {
        const chartData = [
            { label: 'Needs Revision', count: total, color: '#B9720B' }
        ];
        renderChart('p4-chart', chartData);
    }

    // Table
    const tbody = document.getElementById('p4-table-body');
    const display = flagged.slice(0, 6);
    
    if (display.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#6c757d;">No flagged submissions</td></tr>`;
    } else {
        tbody.innerHTML = display.map(r => `
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
    document.getElementById('p4-showing').textContent = `Showing ${Math.min(display.length, flagged.length)} of ${flagged.length} flagged submissions`;
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
    alert('Export CSV functionality coming soon!');
}

function exportPDF(panelId) {
    alert('Export PDF functionality coming soon!');
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