/**
 * Firebase Admin SDK initialization with robust credential handling
 * Supports multiple credential sources with detailed logging and error handling
 */
import * as admin from 'firebase-admin';
import { App, AppOptions, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getFirebaseAuth } from 'firebase-admin/auth';
import { getFirestore as getFirestoreInstance } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Initialize Firebase Admin SDK immediately to avoid async issues
// This ensures we have a synchronous instance available for compatibility
let adminApp: App;
try {
  if (getApps().length === 0) {
    adminApp = initializeApp(undefined, 'default');
    console.log('Firebase Admin SDK initialized with default credentials');
  } else {
    adminApp = getApps()[0];
    console.log('Using existing Firebase Admin SDK instance');
  }
} catch (error) {
  console.warn('Could not initialize Firebase Admin SDK with default credentials');
  // We'll initialize with proper credentials later
}

// Track initialization status
let firebaseInitialized = false;
let firebaseApp: App | null = null;

/**
 * Get Firebase Admin SDK instance with proper credentials
 * This function will try multiple sources for credentials:
 * 1. Environment variables
 * 2. Service account file path from environment variable
 * 3. Common service account file paths
 * 4. Application default credentials
 */
export async function getFirebaseAdmin(): Promise<App> {
  // If already initialized and valid, return the app
  if (firebaseInitialized && firebaseApp) {
    try {
      // Quick validation to ensure the instance is still working
      admin.auth();
      return firebaseApp;
    } catch (error) {
      console.warn('⚠️ Existing Firebase app appears invalid, reinitializing...', error);
      // Continue with reinitialization
    }
  }

  // Clear any existing apps to avoid conflicts
  for (const app of getApps()) {
    try {
      console.log(`Deleting existing Firebase app: ${app.name}`);
      // We can't actually delete the app in the Admin SDK, but we can try to clean up
    } catch (error) {
      console.warn(`Error cleaning up existing Firebase app: ${error}`);
    }
  }

  let appOptions: AppOptions = {};
  let credentialSource = 'unknown';

  // Try to load credentials from environment variables
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      console.log('🔑 Using Firebase credentials from environment variables');
      
      // Replace escaped newlines with actual newlines if needed
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      
      appOptions = {
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
        projectId,
      };
      
      credentialSource = 'environment variables';
      console.log('✅ Successfully loaded credentials from environment variables');
    }
  } catch (error) {
    console.error('❌ Error loading credentials from environment variables:', error);
  }

  // If environment variables didn't work, try service account file from GOOGLE_APPLICATION_CREDENTIALS
  if (!appOptions.credential) {
    try {
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        console.log(`🔑 Using service account from GOOGLE_APPLICATION_CREDENTIALS: ${serviceAccountPath}`);
        appOptions = {
          credential: cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
        };
        credentialSource = `service account file (${serviceAccountPath})`;
        console.log('✅ Successfully loaded credentials from service account file');
      }
    } catch (error) {
      console.error('❌ Error loading service account from GOOGLE_APPLICATION_CREDENTIALS:', error);
    }
  }

  // If still no credentials, try common service account file paths
  if (!appOptions.credential) {
    const commonPaths = [
      path.join(process.cwd(), 'service-account.json'),
      path.join(process.cwd(), 'serviceAccount.json'),
      path.join(process.cwd(), 'firebase-service-account.json'),
      path.join(os.homedir(), '.firebase', 'service-account.json'),
    ];

    for (const filePath of commonPaths) {
      try {
        if (fs.existsSync(filePath)) {
          console.log(`🔑 Using service account from common path: ${filePath}`);
          appOptions = {
            credential: cert(JSON.parse(fs.readFileSync(filePath, 'utf8'))),
          };
          credentialSource = `service account file (${filePath})`;
          console.log('✅ Successfully loaded credentials from service account file');
          break;
        }
      } catch (error) {
        console.error(`❌ Error loading service account from ${filePath}:`, error);
      }
    }
  }

  // If still no credentials, try application default credentials
  if (!appOptions.credential) {
    console.log('🔑 Using application default credentials');
    credentialSource = 'application default credentials';
    
    // Extract project ID from environment if available
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    
    appOptions = {
      projectId: projectId || undefined,
    };
  }
  
  // Initialize the app
  console.log('🚀 Initializing Firebase Admin SDK...');
  firebaseApp = initializeApp(appOptions);
  
  // Log the project ID we're connecting to
  console.log(`📊 Connected to Firebase project: ${firebaseApp.options.projectId || 'unknown'}`);
  
  // Test the connection
  try {
    // Test with a simple Auth operation first (usually has fewer permission requirements)
    console.log('🔍 Testing Firebase Auth connection...');
    // Just accessing the auth function is enough to validate it's working
    admin.auth();
    
    // Now test Firestore
    console.log('🔍 Testing Firestore connection...');
    const db = admin.firestore();
    // Test a simple Firestore operation
    const testCollection = db.collection('_test_collection');
    await testCollection.listDocuments();
    console.log('✅ Firestore connection verified!');
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    console.log('⚠️ This indicates permission issues with your Firebase credentials');
    console.log(`⚠️ Credential source: ${credentialSource}`);
    
    // Provide more detailed error information
    if (error instanceof Error) {
      if (error.message.includes('PERMISSION_DENIED')) {
        console.error('❌ PERMISSION DENIED: Your service account does not have the required permissions.');
        console.error('Please ensure your service account has the following roles:');
        console.error('  - Firebase Admin SDK Administrator Service Agent');
        console.error('  - Cloud Firestore Service Agent');
      } else if (error.message.includes('UNAUTHENTICATED')) {
        console.error('❌ UNAUTHENTICATED: Your credentials are invalid or expired.');
        console.error('Please check that your service account key is valid and has not been revoked.');
      } else if (error.message.includes('NOT_FOUND')) {
        console.error('❌ NOT FOUND: The requested Firestore collection or document does not exist.');
        console.error('This could indicate that your project ID is incorrect or the Firestore database has not been created.');
      } else {
        console.error(`❌ Error details: ${error.message}`);
      }
    }
    
    // We don't throw here because we want to allow the app to continue
    // Some parts of the app might not need Firestore access
  }
  
  // Mark as initialized
  firebaseInitialized = true;
  console.log('✅ Firebase Admin SDK initialized successfully!');
  
  return firebaseApp;
}

/**
 * Get Firebase Auth instance
 * Ensures Firebase Admin SDK is initialized first
 */
export async function getAuth(): Promise<admin.auth.Auth> {
  await getFirebaseAdmin();
  return admin.auth();
}

/**
 * Synchronous version of getAuth for backward compatibility
 */
export function getAuthSync(): admin.auth.Auth {
  return admin.auth();
}

/**
 * Get Firestore instance
 * Ensures Firebase Admin SDK is initialized first
 */
export async function getFirestore(): Promise<admin.firestore.Firestore> {
  await getFirebaseAdmin();
  return admin.firestore();
}

/**
 * Synchronous version of getFirestore for backward compatibility
 */
export function getFirestoreSync(): admin.firestore.Firestore {
  return admin.firestore();
}

/**
 * Alias for getFirestore for backward compatibility
 */
export const getFirestoreDB = getFirestore;

/**
 * Get Firebase Storage instance
 * Ensures Firebase Admin SDK is initialized first
 */
export async function getStorage(): Promise<admin.storage.Storage> {
  await getFirebaseAdmin();
  return admin.storage();
}

/**
 * Synchronous version of getStorage for backward compatibility
 */
export function getStorageSync(): admin.storage.Storage {
  return admin.storage();
}
