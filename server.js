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


// ============ ROOT ROUTE ============

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ============ API ROUTES ============


// Health check endpoint
app.get('/api/health', (req, res) => {

  res.json({
    status: 'OK',
    message: 'Wits Student Societies API is running',
    timestamp: new Date().toISOString()
  });

});


// ============ EMAIL VERIFICATION ENDPOINT ============

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
      website
    } = req.body;


    if (!name || !description) {

      return res.status(400).json({
        error: 'Name and description are required'
      });

    }


    const newSociety = {

      name,
      description,
      category: category || 'General',
      contactEmail: contactEmail || '',
      website: website || '',

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()

    };


    const docRef = await db.collection('societies').add(newSociety);


    res.status(201).json({
      id: docRef.id,
      ...newSociety
    });


  } catch (error) {

    console.error('Error creating society:', error);

    res.status(500).json({
      error: 'Failed to create society'
    });

  }

});


// Update a society
app.put('/api/societies/:id', async (req, res) => {

  try {

    const updateData = {

      name: req.body.name,
      description: req.body.description,
      category: req.body.category || 'General',
      contactEmail: req.body.contactEmail || '',
      website: req.body.website || '',

      updatedAt: admin.firestore.FieldValue.serverTimestamp()

    };


    await db.collection('societies')
      .doc(req.params.id)
      .update(updateData);


    res.json({
      id: req.params.id,
      ...updateData
    });


  } catch (error) {

    console.error('Error updating society:', error);

    res.status(500).json({
      error: 'Failed to update society'
    });

  }

});


// Delete a society
app.delete('/api/societies/:id', async (req, res) => {

  try {

    await db.collection('societies')
      .doc(req.params.id)
      .delete();


    res.json({
      message: 'Society deleted successfully'
    });


  } catch (error) {

    console.error('Error deleting society:', error);

    res.status(500).json({
      error: 'Failed to delete society'
    });

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