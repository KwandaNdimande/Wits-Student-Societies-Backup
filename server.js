// server.js - Main Express server with Firebase integration

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

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


// Azure sits behind a proxy; this lets the rate limiter see the real visitor IP
app.set('trust proxy', 1);

// ============ SECURITY MIDDLEWARE ============

// Security headers (CSP is switched on later, after the inline-script clean-up in Phase E)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: same origin only unless ALLOWED_ORIGIN is set in .env
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : false
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));

// General limit for the whole API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

// Strict limit for routes that send email
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many email requests. Please try again later.' }
});

// Checks that the request carries a valid Firebase login token
async function verifyToken(req, res, next) {
  const match = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = await admin.auth().verifyIdToken(match[1]);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Checks the role stored in Firestore (the browser cannot fake this)
async function requireOfficer(req, res, next) {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'officer') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (error) {
    console.error('Role check error:', error);
    return res.status(500).json({ error: 'Could not verify permissions' });
  }
}

// Protect the whole API by default. Only the health check is public.
app.use('/api', apiLimiter);
const OTP_PATHS = ['/send-otp', '/verify-otp'];
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  return verifyToken(req, res, () => {
    // Accounts that have not verified their email may only use the OTP routes
    if (!req.user.email_verified && !OTP_PATHS.includes(req.path)) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }
    next();
  });
});


// ============ EMAIL TRANSPORTER ============

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
      <h2 style="color:#0B1F3A;margin-top:0">Welcome${name ? ' ' + escapeHtml(name) : ''}!</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6">Thank you for registering for the Wits Student Societies platform. Please use the verification code below to complete your registration:</p>
      
      <div style="text-align:center;padding:20px;margin:20px 0">
        <div style="font-size:36px;letter-spacing:10px;font-weight:bold;background:#f0f4f8;padding:15px;border-radius:8px;font-family:monospace;display:inline-block;color:#0B1F3A">
          ${escapeHtml(code)}
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
      <p style="color:#374151;font-size:15px;line-height:1.6">Your request <strong>"${escapeHtml(requestName)}"</strong> has been updated:</p>
      
      <div style="text-align:center;padding:20px;margin:20px 0;background:#f8f9fa;border-radius:8px">
        <div style="font-size:42px;margin-bottom:8px">${statusEmoji}</div>
        <div style="font-size:24px;font-weight:bold;color:${color}">${escapeHtml(status)}</div>
      </div>
      
      ${officerComment ? `
      <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0">
        <p style="color:#374151;font-size:14px;margin:0"><strong>Officer Comment:</strong></p>
        <p style="color:#5A6B87;font-size:14px;margin:4px 0 0">${escapeHtml(officerComment)}</p>
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
    subject: `Request ${escapeHtml(status)} - ${escapeHtml(requestName)}`,
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
// ============ OTP VERIFICATION ENDPOINTS ============
const OTP_EXPIRY_MINUTES = 15;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

function hashOtp(code, salt) {
  return crypto.createHash('sha256').update(salt + code).digest('hex');
}

function otpMatches(code, salt, storedHash) {
  const a = Buffer.from(hashOtp(code, salt), 'hex');
  const b = Buffer.from(String(storedHash || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

// Create a code and email it to the signed-in user's own address
app.post('/api/send-otp', emailLimiter, async (req, res) => {
  try {
    if (req.user.email_verified) {
      return res.status(400).json({ error: 'Your email is already verified' });
    }
    if (!req.user.email) {
      return res.status(400).json({ error: 'Your account has no email address' });
    }

    const ref = db.collection('emailVerifications').doc(req.user.uid);
    const existing = await ref.get();

    // Cooldown between sends
    if (existing.exists && existing.data().lastSentAt) {
      const secondsSince = (Date.now() - existing.data().lastSentAt.toDate().getTime()) / 1000;
      if (secondsSince < OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSince);
        return res.status(429).json({
          error: `Please wait ${retryAfter} seconds before requesting a new code.`,
          retryAfter
        });
      }
    }

    // Use the name saved at registration (not something the browser sends)
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const u = userDoc.exists ? userDoc.data() : {};
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');

    const code = String(crypto.randomInt(100000, 1000000));
    const salt = crypto.randomBytes(16).toString('hex');

    // Send first; only save the code if the email actually went out
    await sendVerificationEmail(req.user.email, code, name);

    await ref.set({
      userId: req.user.uid,
      email: req.user.email,
      codeHash: hashOtp(code, salt),
      salt,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      lastSentAt: new Date(),
      createdAt: new Date()
    });

    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('send-otp error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Check the code the user typed
app.post('/api/verify-otp', verifyLimiter, async (req, res) => {
  const code = String(req.body.code || '').trim();

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Please enter the 6-digit code.' });
  }

  try {
    if (req.user.email_verified) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    const ref = db.collection('emailVerifications').doc(req.user.uid);

    // A transaction keeps the attempt counter reliable, even if requests overlap
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);

      if (!snap.exists || !snap.data().codeHash) {
        return { status: 400, error: 'No active code. Please request a new one.' };
      }

      const d = snap.data();
      const expiresAt = d.expiresAt && d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(0);

      if (Date.now() > expiresAt.getTime()) {
        t.delete(ref);
        return { status: 400, error: 'Code has expired. Please request a new one.' };
      }

      const attempts = d.attempts || 0;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        return { status: 429, error: 'Too many incorrect attempts. Please request a new code.' };
      }

      if (!otpMatches(code, d.salt, d.codeHash)) {
        t.update(ref, { attempts: attempts + 1 });
        const left = OTP_MAX_ATTEMPTS - attempts - 1;
        return {
          status: 400,
          error: left > 0
            ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
            : 'Incorrect code. Please request a new code.'
        };
      }

      t.delete(ref); // a code can only be used once
      return { ok: true };
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    // Mark the account as verified (this is the flag the login page checks)
    await admin.auth().updateUser(req.user.uid, { emailVerified: true });
    await db.collection('users').doc(req.user.uid).set({
      isEmailVerified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({ success: true, message: 'Email verified' });
  } catch (error) {
    console.error('verify-otp error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ============ PRIVATE FILE STORAGE (SUPABASE) ============
const FILE_BUCKET = 'documents';
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'png', 'jpg', 'jpeg'];

let supabaseAdmin = null;
function getSupabase() {
  if (supabaseAdmin) return supabaseAdmin;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseAdmin;
}

const filesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many file requests. Please try again later.' }
});

function cleanFileName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop();
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(-100);
  return cleaned || 'file';
}

function fileExtension(name) {
  const i = name.lastIndexOf('.');
  return i > -1 ? name.slice(i + 1).toLowerCase() : '';
}

async function userIsOfficer(uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data().role === 'officer';
}

function badStoragePath(p) {
  if (typeof p !== 'string' || !p || p.length > 300) return 'Invalid file path';
  if (p.startsWith('/') || p.includes('..') || p.includes('\\')) return 'Invalid file path';
  if (!p.startsWith('requests/') && !p.startsWith('documents/')) return 'Invalid file path';
  return null;
}

// Step 1 of an upload: the server approves it and returns a one-time token
app.post('/api/files/upload-url', filesLimiter, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'File storage is not configured' });

  try {
    const { kind, fileName, size } = req.body;

    if (kind !== 'request' && kind !== 'library') {
      return res.status(400).json({ error: 'Invalid upload type' });
    }

    const clean = cleanFileName(fileName);
    if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension(clean))) {
      return res.status(400).json({ error: 'This file type is not allowed' });
    }

    if (typeof size !== 'number' || !(size > 0) || size > MAX_FILE_BYTES) {
      return res.status(400).json({ error: 'File is too large (maximum 20 MB)' });
    }

    if (kind === 'library' && !(await userIsOfficer(req.user.uid))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // The folder comes from the verified login, never from the browser
    const folder = kind === 'library' ? 'documents' : `requests/${req.user.uid}`;
    const path = `${folder}/${Date.now()}_${clean}`;

    const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUploadUrl(path);
    if (error) throw error;

    res.json({ path: data.path || path, token: data.token });
  } catch (error) {
    console.error('upload-url error:', error);
    res.status(500).json({ error: 'Could not start the upload' });
  }
});

// Get a short-lived link to view or download one file
app.post('/api/files/sign', filesLimiter, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'File storage is not configured' });

  try {
    const { path, download, fileName } = req.body;

    const problem = badStoragePath(path);
    if (problem) return res.status(400).json({ error: problem });

    const uid = req.user.uid;
    const allowed =
      path.startsWith('documents/') ||
      path.startsWith(`requests/${uid}/`) ||
      (await userIsOfficer(uid));

    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const options = download
      ? { download: cleanFileName(fileName || path.split('/').pop()) }
      : undefined;

    const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, 300, options);
    if (error || !data) return res.status(404).json({ error: 'File not found' });

    res.json({ url: data.signedUrl });
  } catch (error) {
    console.error('sign error:', error);
    res.status(500).json({ error: 'Could not create the file link' });
  }
});

// Delete files (your own request files, or anything if you are an officer)
app.post('/api/files/delete', filesLimiter, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'File storage is not configured' });

  try {
    const { paths } = req.body;

    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 10) {
      return res.status(400).json({ error: 'Provide between 1 and 10 file paths' });
    }
    for (const p of paths) {
      const problem = badStoragePath(p);
      if (problem) return res.status(400).json({ error: problem });
    }

    const uid = req.user.uid;
    const officer = await userIsOfficer(uid);
    const allOwned = paths.every(p => p.startsWith(`requests/${uid}/`));
    if (!officer && !allOwned) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await supabase.storage.from(FILE_BUCKET).remove(paths);
    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('delete files error:', error);
    res.status(500).json({ error: 'Could not delete the file' });
  }
});

// ============ STATUS EMAIL ENDPOINT ============

// Send status update email
const ALLOWED_STATUSES = ['Approved', 'Rejected', 'Revision Required', 'Resubmitted', 'Submitted', 'Under Review'];

app.post('/api/send-status-email', emailLimiter, requireOfficer, async (req, res) => {
  const { email, requestName, status, officerComment } = req.body;
  
  if (!email || !requestName || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
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
app.get('/api/societies', requireOfficer, async (req, res) => {

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
app.get('/api/societies/:id', requireOfficer, async (req, res) => {

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
app.post('/api/societies', requireOfficer, async (req, res) => {

  try {

    const {
      name,
      description,
      category,
      contactEmail,
      website,
      email,
      execCommittee,
    } = req.body;
  


    if (!name || !category || !email) {

      return res.status(400).json({
        error: 'Name, category, and email are required'
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
       createdBy: req.user.uid, // from the verified token

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
app.put('/api/societies/:id', requireOfficer, async (req, res) => {

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
app.delete('/api/societies/:id', requireOfficer, async (req, res) => {
  res.status(405).json({ error: 'Society deletion is not supported' });
});


// Archive a society after quota has not been met.
app.post('/api/societies/:id/archive', requireOfficer, async (req, res) => {
  try {
    const societyRef = db.collection('societies').doc(req.params.id);
    const archivedBy = String(req.body.archivedBy || '').trim() || req.user.uid;
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


// Get all students
app.get('/api/students', requireOfficer, async (req, res) => {

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