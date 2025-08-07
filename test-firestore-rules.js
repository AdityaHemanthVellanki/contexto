#!/usr/bin/env node

/**
 * Firestore Security Rules Test Script
 * 
 * This script tests the Firestore security rules for the mcps collection and logs subcollection
 * using the Firebase Admin SDK (which bypasses security rules) and the Firebase Client SDK
 * (which is subject to security rules).
 */

// Import Firebase Admin SDK for initialization and direct Firestore access
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Import Firebase Client SDK for testing security rules
const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} = require('firebase/auth');
const { 
  getFirestore: getClientFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc
} = require('firebase/firestore');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Logger utility
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let color = colors.reset;
  
  switch (type) {
    case 'success':
      color = colors.green;
      break;
    case 'error':
      color = colors.red;
      break;
    case 'warning':
      color = colors.yellow;
      break;
    case 'info':
      color = colors.cyan;
      break;
    case 'header':
      color = colors.bright + colors.magenta;
      break;
    default:
      color = colors.reset;
  }
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Test class for Firestore security rules
class FirestoreRulesTester {
  constructor(projectId) {
    this.projectId = projectId;
    this.adminApp = null;
    this.clientApp = null;
    this.adminDb = null;
    this.clientDb = null;
    this.auth = null;
    this.testUser = null;
    this.testMcpId = null;
  }
  
  // Initialize Firebase Admin SDK (bypasses security rules)
  async initializeAdmin() {
    log('Initializing Firebase Admin SDK...', 'info');
    
    try {
      // Initialize with application default credentials or service account
      this.adminApp = admin.initializeApp({
        projectId: this.projectId
      }, 'admin-app');
      
      this.adminDb = getFirestore(this.adminApp);
      log('Firebase Admin SDK initialized successfully', 'success');
      return true;
    } catch (error) {
      log(`Failed to initialize Firebase Admin SDK: ${error.message}`, 'error');
      return false;
    }
  }
  
  // Initialize Firebase Client SDK (subject to security rules)
  async initializeClient(config) {
    log('Initializing Firebase Client SDK...', 'info');
    
    try {
      this.clientApp = initializeApp(config, 'client-app');
      this.clientDb = getClientFirestore(this.clientApp);
      this.auth = getAuth(this.clientApp);
      
      log('Firebase Client SDK initialized successfully', 'success');
      return true;
    } catch (error) {
      log(`Failed to initialize Firebase Client SDK: ${error.message}`, 'error');
      return false;
    }
  }
  
  // Create a test user for rule testing
  async createTestUser(email, password) {
    log(`Creating test user: ${email}...`, 'info');
    
    try {
      // First try to sign in with existing credentials
      try {
        const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
        this.testUser = userCredential.user;
        log(`Signed in existing test user: ${this.testUser.email} (${this.testUser.uid})`, 'success');
      } catch (signInError) {
        // If sign in fails, create a new user
        const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
        this.testUser = userCredential.user;
        log(`Created new test user: ${this.testUser.email} (${this.testUser.uid})`, 'success');
      }
      
      return true;
    } catch (error) {
      log(`Failed to create/sign in test user: ${error.message}`, 'error');
      return false;
    }
  }
  
  // Test mcps collection rules
  async testMcpsCollection() {
    log('Testing mcps collection security rules...', 'header');
    
    if (!this.testUser) {
      log('No test user available. Please create a test user first.', 'error');
      return false;
    }
    
    try {
      // 1. Test creating an MCP document with correct userId
      log('Test 1: Creating MCP document with correct userId...', 'info');
      const mcpData = {
        userId: this.testUser.uid,
        title: 'Test MCP',
        fileName: 'test.txt',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const mcpsCollection = collection(this.clientDb, 'mcps');
      const docRef = await addDoc(mcpsCollection, mcpData);
      this.testMcpId = docRef.id;
      
      log(`Successfully created MCP document with ID: ${this.testMcpId}`, 'success');
      
      // 2. Test reading own MCP document
      log('Test 2: Reading own MCP document...', 'info');
      const mcpDocRef = doc(this.clientDb, 'mcps', this.testMcpId);
      const mcpSnapshot = await getDoc(mcpDocRef);
      
      if (mcpSnapshot.exists()) {
        log('Successfully read own MCP document', 'success');
      } else {
        log('Failed to read own MCP document', 'error');
      }
      
      // 3. Test querying MCPs by userId
      log('Test 3: Querying MCPs by userId...', 'info');
      const q = query(mcpsCollection, where('userId', '==', this.testUser.uid));
      const querySnapshot = await getDocs(q);
      
      log(`Successfully queried MCPs. Found ${querySnapshot.size} documents.`, 'success');
      
      // 4. Test updating own MCP document
      log('Test 4: Updating own MCP document...', 'info');
      await setDoc(mcpDocRef, { 
        title: 'Updated Test MCP',
        updatedAt: new Date()
      }, { merge: true });
      
      log('Successfully updated own MCP document', 'success');
      
      return true;
    } catch (error) {
      log(`Error testing mcps collection: ${error.message}`, 'error');
      return false;
    }
  }
  
  // Test mcps/{mcpId}/logs subcollection rules
  async testMcpsLogsSubcollection() {
    log('Testing mcps/{mcpId}/logs subcollection security rules...', 'header');
    
    if (!this.testUser || !this.testMcpId) {
      log('No test user or MCP document available. Please run testMcpsCollection first.', 'error');
      return false;
    }
    
    try {
      // 1. Test creating a log document
      log('Test 1: Creating log document...', 'info');
      const logsCollection = collection(this.clientDb, 'mcps', this.testMcpId, 'logs');
      const logData = {
        message: 'Test log entry',
        timestamp: new Date(),
        level: 'info'
      };
      
      const logDocRef = await addDoc(logsCollection, logData);
      
      log(`Successfully created log document with ID: ${logDocRef.id}`, 'success');
      
      // 2. Test reading logs
      log('Test 2: Reading logs...', 'info');
      const querySnapshot = await getDocs(logsCollection);
      
      log(`Successfully read logs. Found ${querySnapshot.size} documents.`, 'success');
      
      return true;
    } catch (error) {
      log(`Error testing logs subcollection: ${error.message}`, 'error');
      return false;
    }
  }
  
  // Clean up test data
  async cleanup() {
    log('Cleaning up test data...', 'info');
    
    if (this.testMcpId) {
      try {
        // Delete the test MCP document using admin SDK to bypass security rules
        await this.adminDb.collection('mcps').doc(this.testMcpId).delete();
        log(`Deleted test MCP document: ${this.testMcpId}`, 'success');
      } catch (error) {
        log(`Failed to delete test MCP document: ${error.message}`, 'error');
      }
    }
    
    // Sign out the test user
    if (this.auth) {
      try {
        await this.auth.signOut();
        log('Signed out test user', 'success');
      } catch (error) {
        log(`Failed to sign out test user: ${error.message}`, 'error');
      }
    }
    
    return true;
  }
}

// Main function to run the tests
async function main() {
  console.log('\n');
  log('🔒 FIRESTORE SECURITY RULES TEST', 'header');
  log('=====================================', 'header');
  
  // Get Firebase project ID from command line or environment
  const projectId = process.argv[2] || process.env.FIREBASE_PROJECT_ID;
  
  if (!projectId) {
    log('Please provide a Firebase project ID as an argument or set FIREBASE_PROJECT_ID environment variable', 'error');
    process.exit(1);
  }
  
  // Get Firebase web config from command line arguments
  const apiKey = process.argv[3] || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.argv[4] || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
  
  if (!apiKey) {
    log('Please provide a Firebase API key as the second argument or set NEXT_PUBLIC_FIREBASE_API_KEY environment variable', 'error');
    process.exit(1);
  }
  
  // Firebase web config
  const firebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: '000000000000', // Not needed for this test
    appId: '1:000000000000:web:0000000000000000000000' // Not needed for this test
  };
  
  // Create tester instance
  const tester = new FirestoreRulesTester(projectId);
  
  // Initialize Firebase Admin SDK
  const adminInitialized = await tester.initializeAdmin();
  if (!adminInitialized) {
    log('Failed to initialize Firebase Admin SDK. Exiting.', 'error');
    process.exit(1);
  }
  
  // Initialize Firebase Client SDK
  const clientInitialized = await tester.initializeClient(firebaseConfig);
  if (!clientInitialized) {
    log('Failed to initialize Firebase Client SDK. Exiting.', 'error');
    process.exit(1);
  }
  
  // Create test user
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test123!';
  const userCreated = await tester.createTestUser(testEmail, testPassword);
  if (!userCreated) {
    log('Failed to create test user. Exiting.', 'error');
    process.exit(1);
  }
  
  // Run tests
  let mcpsTestPassed = false;
  let logsTestPassed = false;
  
  try {
    // Test mcps collection rules
    mcpsTestPassed = await tester.testMcpsCollection();
    
    // Test mcps/{mcpId}/logs subcollection rules
    if (mcpsTestPassed) {
      logsTestPassed = await tester.testMcpsLogsSubcollection();
    }
  } finally {
    // Clean up test data
    await tester.cleanup();
  }
  
  // Print test summary
  console.log('\n');
  log('📊 TEST SUMMARY', 'header');
  log('=====================================', 'header');
  log(`MCPs Collection Rules: ${mcpsTestPassed ? '✅ PASSED' : '❌ FAILED'}`, mcpsTestPassed ? 'success' : 'error');
  log(`MCPs Logs Subcollection Rules: ${logsTestPassed ? '✅ PASSED' : '❌ FAILED'}`, logsTestPassed ? 'success' : 'error');
  log('=====================================', 'header');
  
  // Exit with appropriate code
  process.exit(mcpsTestPassed && logsTestPassed ? 0 : 1);
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`, 'error');
    process.exit(1);
  });
}
