// Test script for deployServer API with authentication
const fetch = require('node-fetch');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, getIdToken } = require('firebase/auth');
require('dotenv').config();

// Firebase client config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase client
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testDeployServerAPI() {
  try {
    // Replace with test credentials
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    
    if (!email || !password) {
      console.error('❌ Test credentials not found in environment variables');
      console.log('Please set TEST_USER_EMAIL and TEST_USER_PASSWORD in your .env file');
      return;
    }

    // Sign in to get ID token
    console.log('🔑 Signing in to get authentication token...');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await getIdToken(userCredential.user);
    
    console.log('✅ Successfully obtained ID token');
    
    // Test pipeline ID - replace with an actual pipeline ID from your database
    const testPipelineId = process.env.TEST_PIPELINE_ID || 'test-pipeline-123';
    
    // Call the deployServer API with authentication
    console.log(`🚀 Testing /api/deployServer with pipeline ID: ${testPipelineId}`);
    const response = await fetch('http://localhost:3000/api/deployServer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ pipelineId: testPipelineId })
    });
    
    const data = await response.json();
    
    console.log(`📊 Response status: ${response.status}`);
    console.log('📋 Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing deployServer API:', error);
  }
}

testDeployServerAPI();
