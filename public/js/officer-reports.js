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

// Report data (this could be generated from Firestore data)
const reportData = {
    "Budget Request Summary": {
        headers: ["Society", "Type", "Amount", "Status"],
        rows: []
    },
    "Society Activity Report": {
        headers: ["Society", "Category", "Requests", "Last Active"],
        rows: []
    }
};

// Load report data from Firestore
async function loadReportData() {
    try {
        // Get all requests
        const requestsSnapshot = await db.collection('requests').get();
        const requests = [];
        requestsSnapshot.forEach(doc => {
            requests.push(doc.data());
        });

        // Get all societies
        const societiesSnapshot = await db.collection('societies').get();
        const societies = [];
        societiesSnapshot.forEach(doc => {
            societies.push({ id: doc.id, ...doc.data() });
        });

        // Build Budget Request Summary
        const budgetSummary = reportData["Budget Request Summary"];
        budgetSummary.rows = requests.map(r => [
            r.societyName || 'Unknown',
            r.type || 'N/A',
            `R${r.amount ? r.amount.toLocaleString() : '0'}`,
            r.status || 'N/A'
        ]);

        // Build Society Activity Report
        const activityReport = reportData["Society Activity Report"];
        societies.forEach(s => {
            const societyRequests = requests.filter(r => r.societyName === s.name);
            const lastActive = societyRequests.length > 0 ? 
                new Date(Math.max(...societyRequests.map(r => r.submittedAt ? r.submittedAt.seconds : 0)) * 1000).toLocaleDateString() :
                'Never';
            activityReport.rows.push([
                s.name,
                s.category || 'General',
                societyRequests.length,
                lastActive
            ]);
        });

    } catch (error) {
        console.error('Error loading report data:', error);
    }
}

const select = document.getElementById('report-select');
const container = document.getElementById('report-container');
const exportBtn = document.getElementById('export-btn');

select.addEventListener('change', function() {
    const reportName = this.value;
    
    if (!reportName) {
        container.innerHTML = '<p style="color:#6c757d;font-size:14px;">Select a report type to view data.</p>';
        exportBtn.disabled = true;
        return;
    }

    const data = reportData[reportName];
    if (!data || data.rows.length === 0) {
        container.innerHTML = '<p style="color:#6c757d;font-size:14px;">No data available for this report.</p>';
        exportBtn.disabled = true;
        return;
    }

    exportBtn.disabled = false;

    // Build table
    let html = `
        <div style="border:1px solid #dee2e6;border-radius:8px;overflow-x:auto;background:white;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead style="background:#f1f3f5;border-bottom:1px solid #dee2e6;">
                    <tr>
    `;

    data.headers.forEach(h => {
        html += `<th style="padding:12px 16px;text-align:left;font-weight:500;color:#6c757d;">${h}</th>`;
    });

    html += `
                    </tr>
                </thead>
                <tbody>
    `;

    data.rows.forEach(row => {
        html += `<tr style="border-bottom:1px solid #f1f3f5;">`;
        row.forEach(cell => {
            html += `<td style="padding:12px 16px;">${cell}</td>`;
        });
        html += `</tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
});

function exportReport() {
    const reportName = select.value;
    if (!reportName) return;
    
    alert(`Exporting "${reportName}"...\n\nThis will download the report as a CSV file.`);
    // TODO: Implement CSV export
}

// Load data
loadReportData();