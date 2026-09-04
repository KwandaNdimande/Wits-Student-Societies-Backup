// server.js - Main Express server with Firebase integration

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
let serviceAccount;

try {

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {

    // Azure production environment
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    console.log("Using Firebase credentials from Azure environment");

  } else {

    // Local development environment
    const rawData = fs.readFileSync('./serviceAccountKey.json', 'utf8');
    serviceAccount = JSON.parse(rawData);

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    console.log("Using local Firebase credentials file");
  }


} catch (error) {

  console.error('Error loading Firebase credentials:', error.message);
  process.exit(1);

}


// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const db = admin.firestore();


// Create Express app
const app = express();

const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ============ EMAIL TRANSPORTER ============

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ============ OTP VERIFICATION EMAIL ============

// Email sender function with SGO branding
async function sendVerificationEmail(toEmail, code, name = "") {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#0B1F3A;padding:24px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:0.5px;">🏛️ SGO Digital Operations</h1>
      <p style="color:#8FA6CC;margin:4px 0 0;font-size:14px">Student Governance Office • University of the Witwatersrand</p>
    </div>
    <div style="padding:32px">
      <h2 style="color:#0B1F3A;margin-top:0">Welcome${name ? ' ' + name : ''}!</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6">Thank you for registering for the Wits Student Societies platform. Please use the verification code below to complete your registration:</p>
      
      <div style="text-align:center;padding:20px;margin:20px 0">
        <div style="font-size:36px;letter-spacing:10px;font-weight:bold;background:#f0f4f8;padding:15px;border-radius:8px;font-family:monospace;display:inline-block;color:#0B1F3A">
          ${code}
        </div>
      </div>
      
      <p style="color:#6b7280;font-size:14px">This code will expire in <strong>15 minutes</strong>.</p>
      <p style="color:#6b7280;font-size:14px;margin-top:4px">If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div style="background:#f3f4f6;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Student Governance Office (SGO)</p>
      <p style="color:#9ca3af;font-size:11px;margin:4px 0 0">University of the Witwatersrand, Johannesburg</p>
      <p style="color:#9ca3af;font-size:10px;margin:4px 0 0;font-style:italic;">This is an automated message, please do not reply.</p>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"SGO Digital Operations" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Verify Your Email - Wits Student Societies",
    html,
  });
}

// ============ STATUS UPDATE EMAIL ============

// Send status update email to leader
async function sendStatusEmail(toEmail, requestName, status, officerComment = "") {
  const statusColors = {
    'Approved': '#1E8E5A',
    'Rejected': '#C0392B',
    'Revision Required': '#B9720B',
    'Resubmitted': '#2E6FBA',
    'Submitted': '#2E6FBA',
    'Under Review': '#2E6FBA'
  };
  
  const color = statusColors[status] || '#2E6FBA';
  const statusEmoji = status === 'Approved' ? '✅' : 
                      status === 'Rejected' ? '❌' : 
                      status === 'Revision Required' ? '📝' : '📋';
  
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#0B1F3A;padding:24px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:0.5px;">🏛️ SGO Digital Operations</h1>
      <p style="color:#8FA6CC;margin:4px 0 0;font-size:14px">Student Governance Office • University of the Witwatersrand</p>
    </div>
    <div style="padding:32px">
      <h2 style="color:#0B1F3A;margin-top:0">Request Status Update</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6">Your request <strong>"${requestName}"</strong> has been updated:</p>
      
      <div style="text-align:center;padding:20px;margin:20px 0;background:#f8f9fa;border-radius:8px">
        <div style="font-size:42px;margin-bottom:8px">${statusEmoji}</div>
        <div style="font-size:24px;font-weight:bold;color:${color}">${status}</div>
      </div>
      
      ${officerComment ? `
      <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0">
        <p style="color:#374151;font-size:14px;margin:0"><strong>Officer Comment:</strong></p>
        <p style="color:#5A6B87;font-size:14px;margin:4px 0 0">${officerComment}</p>
      </div>
      ` : ''}
      
      ${status === 'Revision Required' ? `
      <div style="background:#fff3cd;padding:16px;border-radius:8px;margin:16px 0">
        <p style="color:#856404;font-size:14px;margin:0"><strong>⚠️ Action Required</strong></p>
        <p style="color:#856404;font-size:14px;margin:4px 0 0">Please update your documents and resubmit.</p>
      </div>
      ` : ''}
      
      ${status === 'Approved' ? `
      <div style="background:#d4edda;padding:16px;border-radius:8px;margin:16px 0">
        <p style="color:#155724;font-size:14px;margin:0"><strong>✅ Congratulations!</strong></p>
        <p style="color:#155724;font-size:14px;margin:4px 0 0">Your request has been approved.</p>
      </div>
      ` : ''}
      
      ${status === 'Rejected' ? `
      <div style="background:#f8d7da;padding:16px;border-radius:8px;margin:16px 0">
        <p style="color:#721c24;font-size:14px;margin:0"><strong>❌ Request Rejected</strong></p>
        <p style="color:#721c24;font-size:14px;margin:4px 0 0">Please contact the SGO office for more information.</p>
      </div>
      ` : ''}
      
      ${status === 'Resubmitted' ? `
      <div style="background:#E3F2FD;padding:16px;border-radius:8px;margin:16px 0">
        <p style="color:#0D47A1;font-size:14px;margin:0"><strong>📤 Resubmitted</strong></p>
        <p style="color:#0D47A1;font-size:14px;margin:4px 0 0">Your updated documents have been submitted for review.</p>
      </div>
      ` : ''}
    </div>
    <div style="background:#f3f4f6;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Student Governance Office (SGO)</p>
      <p style="color:#9ca3af;font-size:11px;margin:4px 0 0">University of the Witwatersrand, Johannesburg</p>
      <p style="color:#9ca3af;font-size:10px;margin:4px 0 0;font-style:italic;">This is an automated message, please do not reply.</p>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"SGO Digital Operations" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Request ${status} - ${requestName}`,
    html,
  });
}


// ============ ROOT ROUTE ============

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ============ API ROUTES ============

// Helper function to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to validate text fields (name, description, etc.)
// Must contain at least one letter; reject numeric-only values
function isValidTextField(value) {
  const text = String(value || '').trim();
  if (!text || text.length === 0) return false;
  // Must contain at least one letter (a-z, A-Z)
  if (!/[a-zA-Z]/.test(text)) return false;
  return true;
}

function normalizeSocietyName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatSocietyName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').split(' ').map(word =>
    word.split(/([-'])/).map(part => /^[a-z]/i.test(part)
      ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      : part
    ).join('')
  ).join(' ');
}

// Helper function to validate executive committee structure
function validateExecCommittee(execCommittee) {
  if (!execCommittee || typeof execCommittee !== 'object') {
    return { valid: false, error: 'Executive committee must be an object' };
  }

  const requiredPortfolios = ['chairperson', 'deputyChairperson', 'treasurer', 'secretary', 'organiser'];
  
  for (const portfolio of requiredPortfolios) {
    const portfolioData = execCommittee[portfolio];
    
    if (!portfolioData) {
      return { valid: false, error: `${portfolio} is missing` };
    }

    const name = portfolioData.name || '';
    const email = portfolioData.email || '';

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return { valid: false, error: `${portfolio} name is required` };
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return { valid: false, error: `${portfolio} email is required` };
    }

    if (!isValidEmail(email)) {
      return { valid: false, error: `${portfolio} email is invalid` };
    }
  }

  // Validate otherPortfolios if they exist
  if (execCommittee.otherPortfolios && Array.isArray(execCommittee.otherPortfolios)) {
    for (let i = 0; i < execCommittee.otherPortfolios.length; i++) {
      const portfolio = execCommittee.otherPortfolios[i];
      
      const title = portfolio.title || '';
      const name = portfolio.name || '';
      const email = portfolio.email || '';

      if (!title || typeof title !== 'string' || title.trim() === '') {
        return { valid: false, error: `Other portfolio ${i + 1} title is required` };
      }

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return { valid: false, error: `Other portfolio ${i + 1} member name is required` };
      }

      if (!email || typeof email !== 'string' || email.trim() === '') {
        return { valid: false, error: `Other portfolio ${i + 1} member email is required` };
      }

      if (!isValidEmail(email)) {
        return { valid: false, error: `Other portfolio ${i + 1} member email is invalid` };
      }
    }
  }

  return { valid: true };
}

// ============ API ROUTES ============


// Health check endpoint
app.get('/api/health', (req, res) => {

  res.json({
    status: 'OK',
    message: 'Wits Student Societies API is running',
    timestamp: new Date().toISOString()
  });

});


// ============ OTP VERIFICATION ENDPOINT ============

// Send verification email
app.post('/api/send-verification-email', async (req, res) => {
  const { email, code, name } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }
  
  try {
    await sendVerificationEmail(email, code, name);
    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});


// ============ STATUS EMAIL ENDPOINT ============

// Send status update email
app.post('/api/send-status-email', async (req, res) => {
  const { email, requestName, status, officerComment } = req.body;
  
  if (!email || !requestName || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    await sendStatusEmail(email, requestName, status, officerComment);
    res.json({ success: true, message: 'Status email sent' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});


// Get all societies
app.get('/api/societies', async (req, res) => {

  try {

    const snapshot = await db.collection('societies').get();

    const societies = [];

    snapshot.forEach(doc => {

      societies.push({
        id: doc.id,
        ...doc.data()
      });

    });

    res.json(societies);


  } catch (error) {

    console.error('Error fetching societies:', error);

    res.status(500).json({
      error: 'Failed to fetch societies'
    });

  }

});


// Get a single society by ID
app.get('/api/societies/:id', async (req, res) => {

  try {

    const doc = await db.collection('societies')
      .doc(req.params.id)
      .get();


    if (!doc.exists) {

      return res.status(404).json({
        error: 'Society not found'
      });

    }


    res.json({
      id: doc.id,
      ...doc.data()
    });


  } catch (error) {

    console.error('Error fetching society:', error);

    res.status(500).json({
      error: 'Failed to fetch society'
    });

  }

});


// Create a new society
app.post('/api/societies', async (req, res) => {

  try {

    const {
      name,
      description,
      category,
      contactEmail,
      website,
      email,
      execCommittee,
      createdBy
    } = req.body;


    if (!name || !category || !email) {

      return res.status(400).json({
        error: 'Name, category, and email are required'
      });

    }

    // Validate name contains at least one letter
    if (!isValidTextField(name)) {
      return res.status(400).json({
        error: 'Society name must contain at least one letter and cannot be numeric-only'
      });
    }

    // Validate description if provided
    if (description && !isValidTextField(description)) {
      return res.status(400).json({
        error: 'Description must contain at least one letter and cannot be numeric-only'
      });
    }

    const formattedName = formatSocietyName(name);
    const normalizedName = normalizeSocietyName(formattedName);

    // Validate executive committee if provided
    if (execCommittee) {
      const validation = validateExecCommittee(execCommittee);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid executive committee: ' + validation.error
        });
      }
    }

    const newSociety = {

      name: formattedName,
      normalizedName,
      description: description || '',
      category,
      email,
      website: website || '',
      execCommittee: execCommittee || {},
      createdBy: createdBy || '',

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()

    };


    const docRef = db.collection('societies').doc();
    const nameRef = db.collection('societyNames').doc(normalizedName);

    await db.runTransaction(async transaction => {
      const nameReservation = await transaction.get(nameRef);
      const existingSocieties = await transaction.get(db.collection('societies'));
      const duplicate = existingSocieties.docs.some(doc =>
        normalizeSocietyName(doc.data().name || doc.data().normalizedName) === normalizedName
      );

      if (nameReservation.exists || duplicate) {
        const error = new Error('A society with this name already exists');
        error.code = 'duplicate-society-name';
        throw error;
      }

      transaction.create(docRef, newSociety);
      transaction.create(nameRef, { societyId: docRef.id, name: formattedName });
    });


    res.status(201).json({
      id: docRef.id,
      ...newSociety
    });


  } catch (error) {

    console.error('Error creating society:', error);

    res.status(error.code === 'duplicate-society-name' ? 409 : 500).json({
      error: error.code === 'duplicate-society-name' ? error.message : 'Failed to create society'
    });

  }

});


// Update a society
app.put('/api/societies/:id', async (req, res) => {

  try {

    const {
      name,
      description,
      category,
      email,
      website,
      execCommittee
    } = req.body;

    if (name !== undefined && (!name || typeof name !== 'string')) {
      return res.status(400).json({ error: 'Society name is required' });
    }

    // Validate name contains at least one letter if being updated
    if (name !== undefined && !isValidTextField(name)) {
      return res.status(400).json({
        error: 'Society name must contain at least one letter and cannot be numeric-only'
      });
    }

    // Validate description if provided
    if (description !== undefined && description && !isValidTextField(description)) {
      return res.status(400).json({
        error: 'Description must contain at least one letter and cannot be numeric-only'
      });
    }

    // Validate executive committee if provided
    if (execCommittee) {
      const validation = validateExecCommittee(execCommittee);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid executive committee: ' + validation.error
        });
      }
    }

    const updateData = {

      updatedAt: admin.firestore.FieldValue.serverTimestamp()

    };

    if (name !== undefined) {
      updateData.name = formatSocietyName(name);
      updateData.normalizedName = normalizeSocietyName(updateData.name);
    }
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (execCommittee !== undefined) updateData.execCommittee = execCommittee;

    const societyRef = db.collection('societies').doc(req.params.id);
    await db.runTransaction(async transaction => {
      const societySnapshot = await transaction.get(societyRef);
      if (!societySnapshot.exists) {
        const error = new Error('Society not found');
        error.code = 'society-not-found';
        throw error;
      }

      if (name !== undefined) {
        const normalizedName = updateData.normalizedName;
        const nameRef = db.collection('societyNames').doc(normalizedName);
        const nameReservation = await transaction.get(nameRef);
        const existingSocieties = await transaction.get(db.collection('societies'));
        const duplicate = existingSocieties.docs.some(doc => doc.id !== req.params.id &&
          normalizeSocietyName(doc.data().name || doc.data().normalizedName) === normalizedName
        );

        if ((nameReservation.exists && nameReservation.data().societyId !== req.params.id) || duplicate) {
          const error = new Error('A society with this name already exists');
          error.code = 'duplicate-society-name';
          throw error;
        }

        const previousName = normalizeSocietyName(societySnapshot.data().name || societySnapshot.data().normalizedName);
        if (previousName && previousName !== normalizedName) {
          transaction.delete(db.collection('societyNames').doc(previousName));
        }
        transaction.set(nameRef, { societyId: req.params.id, name: updateData.name });
      }

      transaction.update(societyRef, updateData);
    });


    res.json({
      id: req.params.id,
      ...updateData
    });


  } catch (error) {

    console.error('Error updating society:', error);

    const status = error.code === 'duplicate-society-name' ? 409 : error.code === 'society-not-found' ? 404 : 500;
    res.status(status).json({
      error: status === 409 || status === 404 ? error.message : 'Failed to update society'
    });

  }

});


// Deletion is intentionally unsupported; societies are retained by archiving.
app.delete('/api/societies/:id', async (req, res) => {
  res.status(405).json({ error: 'Society deletion is not supported' });
});


// Archive a society after quota has not been met.
app.post('/api/societies/:id/archive', async (req, res) => {
  try {
    const societyRef = db.collection('societies').doc(req.params.id);
    const archivedBy = String(req.body.archivedBy || '').trim();
    if (!archivedBy) return res.status(400).json({ error: 'archivedBy is required' });
    if (req.body.subscriptionQuota !== 'not-met') {
      return res.status(400).json({ error: 'Society can only be archived when subscription quota is not met' });
    }

    await societyRef.update({
      status: 'archived',
      subscriptionQuota: 'not-met',
      archivedBy,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ message: 'Society archived successfully' });
  } catch (error) {
    console.error('Error archiving society:', error);
    res.status(500).json({ error: 'Failed to archive society' });
  }
});


// ============ DELETION RECORDS ENDPOINTS ============

// Get all deletion records
app.get('/api/deletionRecords', async (req, res) => {
  try {
    const snapshot = await db.collection('deletionRecords')
      .orderBy('deletedAt', 'desc')
      .get();

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    res.json(records);
  } catch (error) {
    console.error('Error fetching deletion records:', error);
    res.status(500).json({ error: 'Failed to fetch deletion records' });
  }
});

// Create a deletion record (when a request is deleted)
app.post('/api/deletionRecords', async (req, res) => {
  try {
    const {
      requestId,
      requestName,
      type,
      society,
      previousStatus,
      deletedBy,
      reason
    } = req.body;

    if (!requestId || !requestName || !society || !previousStatus || !deletedBy) {
      return res.status(400).json({
        error: 'Missing required fields: requestId, requestName, society, previousStatus, deletedBy'
      });
    }

    const deletionRecord = {
      requestId,
      requestName,
      type: type || 'Unknown',
      society,
      previousStatus,
      deletedBy,
      reason: reason || '',
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('deletionRecords').add(deletionRecord);

    res.status(201).json({
      id: docRef.id,
      ...deletionRecord
    });
  } catch (error) {
    console.error('Error creating deletion record:', error);
    res.status(500).json({ error: 'Failed to create deletion record' });
  }
});


// Get all students
app.get('/api/students', async (req, res) => {

  try {

    const snapshot = await db.collection('students').get();

    const students = [];

    snapshot.forEach(doc => {

      students.push({
        id: doc.id,
        ...doc.data()
      });

    });


    res.json(students);


  } catch (error) {

    console.error('Error fetching students:', error);

    res.status(500).json({
      error: 'Failed to fetch students'
    });

  }

});


// ============ START SERVER ============

app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);
  console.log(`API health check: http://localhost:${PORT}/api/health`);
  console.log(`Serving static files from /public`);

});