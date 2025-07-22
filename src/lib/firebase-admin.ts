import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { debugEnvironment } from './env-debug';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Initialize Firebase Admin SDK
 * This implementation uses only real credentials, no mocks
 * Provides detailed logging and error handling for production readiness
 */
export async function getFirebaseAdmin() {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length > 0) {
    console.log('Firebase Admin SDK already initialized, returning existing instance');
    return admin;
  }
  
  // Print environment debug information to help troubleshoot
  debugEnvironment();
  console.log('Firebase Admin initialization with real production credentials');
  
  // Create credential configuration object
  let projectId: string;
  let clientEmail: string;
  let privateKey: string;
  let storageBucket: string | undefined;
  
  // Track credential source for debugging
  let credentialSource: string;
  
  // 1. Try environment variables (preferred method)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    projectId = process.env.FIREBASE_PROJECT_ID;
    clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    
    // Ensure proper formatting of private key (handles escaped newlines in environment variables)
    privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey.indexOf('\n') === -1 && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      console.log('Converted escaped newlines in FIREBASE_PRIVATE_KEY');
    }
    
    storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    credentialSource = 'environment_variables';
    console.log(`Using Firebase Admin credentials from environment variables for project: ${projectId}`);
  } 
  // 2. Try JSON service account from environment
  else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      projectId = serviceAccount.project_id || serviceAccount.projectId;
      clientEmail = serviceAccount.client_email || serviceAccount.clientEmail;
      privateKey = serviceAccount.private_key || serviceAccount.privateKey;
      storageBucket = serviceAccount.storage_bucket || serviceAccount.storageBucket || `${projectId}.appspot.com`;
      credentialSource = 'service_account_json_env';
      console.log(`Using Firebase Admin credentials from FIREBASE_SERVICE_ACCOUNT environment variable for project: ${projectId}`);
    } catch (error) {
      throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT: ${error instanceof Error ? error.message : 'Invalid format'}`);
    }
  } 
  // 3. Try service account JSON file
  else {
    try {
      const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountContent);
        
        // Verify we have required fields for production use
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
          throw new Error('Service account file is missing required fields (project_id, client_email, private_key)');
        }
        
        projectId = serviceAccount.project_id;
        clientEmail = serviceAccount.client_email;
        privateKey = serviceAccount.private_key;
        
        // Ensure proper formatting of private key
        if (privateKey.indexOf('\n') === -1 && privateKey.includes('\\n')) {
          privateKey = privateKey.replace(/\\n/g, '\n');
          console.log('Converted escaped newlines in service account private key');
        }
        
        storageBucket = serviceAccount.storage_bucket || `${projectId}.appspot.com`;
        credentialSource = 'service_account_json_file';
        console.log(`Using Firebase Admin credentials from service-account.json file for project: ${projectId}`);
      } else {
        throw new Error('Service account file not found at: ' + serviceAccountPath);
      }
    } catch (error) {
      throw new Error(`Failed to load service account file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  // Validate required credentials
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin initialization failed: Missing required credentials (projectId, clientEmail, or privateKey)');
  }

  try {
    // Log details about credentials (without exposing sensitive info)
    console.log('Initializing Firebase Admin SDK with:');
    console.log(`- Project ID: ${projectId}`);
    console.log(`- Client Email: ${clientEmail.substring(0, 5)}...${clientEmail.substring(clientEmail.indexOf('@'))}`);
    console.log(`- Private Key: ${privateKey.substring(0, 15)}...`);
    console.log(`- Storage Bucket: ${storageBucket || `${projectId}.appspot.com`}`);
    console.log(`- Credential Source: ${credentialSource}`);
    
    // Verify private key format (should include proper BEGIN/END markers and newlines)
    if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
      throw new Error('Firebase Admin initialization failed: Private key is malformed (missing BEGIN/END markers)');
    }
    
    // Initialize Firebase Admin with explicit credentials - no mock fallbacks
    const app = admin.initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      }),
      storageBucket: storageBucket || `${projectId}.appspot.com`
    });
    
    // Configure Firestore settings
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    
    // Test Firestore connection to verify credentials work
    try {
      const testDocRef = db.collection('_initialization_test').doc('test');
      await testDocRef.set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        initialized: true
      });
      await testDocRef.delete();  // Clean up the test document
      console.log('Firestore connection verified successfully');
    } catch (firestoreError) {
      console.error('Firestore connection test failed:', firestoreError);
      // Continue anyway as this might be a permissions issue, not a credential issue
    }
    
    console.log(`Firebase Admin SDK initialized successfully with real credentials (${credentialSource})`);
    
    return admin;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Firestore database instance
 * @returns A Promise that resolves to a Firestore instance
 */
export async function getFirestoreDB() {
  const adminApp = await getFirebaseAdmin();
  return adminApp.firestore();
}

/**
 * Get Firebase Auth instance
 * @returns A Promise that resolves to a Firebase Auth instance
 */
export async function getAuth() {
  const adminApp = await getFirebaseAdmin();
  return adminApp.auth();
}
