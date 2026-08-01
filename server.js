// server.js - Main Express server with Firebase integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin SDK
let serviceAccount;

try {
  // Load from file (for local development)
  const rawData = fs.readFileSync('./serviceAccountKey.json', 'utf8');
  serviceAccount = JSON.parse(rawData);
  
  // Fix the private key format - ensure proper line breaks
  if (serviceAccount.private_key) {
    // The key from Firebase Console sometimes has \n escaped
    // We need to make sure it's properly formatted
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} catch (error) {
  console.error('Error loading Firebase credentials:', error.message);
  console.log('Please ensure serviceAccountKey.json exists in the project root');
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

// ============ API ROUTES ============

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Wits Student Societies API is running',
    timestamp: new Date().toISOString()
  });
});

// Get all societies
app.get('/api/societies', async (req, res) => {
  try {
    const snapshot = await db.collection('societies').get();
    const societies = [];
    snapshot.forEach(doc => {
      societies.push({ id: doc.id, ...doc.data() });
    });
    res.json(societies);
  } catch (error) {
    console.error('Error fetching societies:', error);
    res.status(500).json({ error: 'Failed to fetch societies' });
  }
});

// Get a single society by ID
app.get('/api/societies/:id', async (req, res) => {
  try {
    const doc = await db.collection('societies').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Society not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching society:', error);
    res.status(500).json({ error: 'Failed to fetch society' });
  }
});

// Create a new society
app.post('/api/societies', async (req, res) => {
  try {
    const { name, description, category, contactEmail, website } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
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
    res.status(201).json({ id: docRef.id, ...newSociety });
  } catch (error) {
    console.error('Error creating society:', error);
    res.status(500).json({ error: 'Failed to create society' });
  }
});

// Update a society
app.put('/api/societies/:id', async (req, res) => {
  try {
    const { name, description, category, contactEmail, website } = req.body;
    
    const updateData = {
      name,
      description,
      category: category || 'General',
      contactEmail: contactEmail || '',
      website: website || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('societies').doc(req.params.id).update(updateData);
    res.json({ id: req.params.id, ...updateData });
  } catch (error) {
    console.error('Error updating society:', error);
    res.status(500).json({ error: 'Failed to update society' });
  }
});

// Delete a society
app.delete('/api/societies/:id', async (req, res) => {
  try {
    await db.collection('societies').doc(req.params.id).delete();
    res.json({ message: 'Society deleted successfully' });
  } catch (error) {
    console.error('Error deleting society:', error);
    res.status(500).json({ error: 'Failed to delete society' });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const snapshot = await db.collection('students').get();
    const students = [];
    snapshot.forEach(doc => {
      students.push({ id: doc.id, ...doc.data() });
    });
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 API health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Serving static files from /public`);
});