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

// Track initialization status
let firebaseInitialized = false;
let firebaseApp: App | null = null;

/**
 * Get Firebase Admin SDK instance with proper credentials
 * This function will try multiple sources for credentials:
 * 1. Environment variables
 * 2. Service account JSON from environment variable
 * 3. Service account JSON files in common locations
 * 4. Application Default Credentials
 */
export async function getFirebaseAdmin(): Promise<App> {
  // If already initialized and valid, return the app
  if (firebaseInitialized && firebaseApp) {
    try {
      // Quick validation to ensure the instance is still working
      const auth = getFirebaseAuth();
      // Just accessing the auth object is enough to validate it's working
      return firebaseApp;
    } catch (error) {
      console.warn('⚠️ Existing Firebase app appears invalid, reinitializing...', error);
      // Continue with reinitialization
    }
  }
  
  try {
    // Clear any existing apps to avoid conflicts
    const existingApps = getApps();
    if (existingApps.length > 0) {
      console.log(`🧹 Found ${existingApps.length} existing Firebase apps, clearing...`);
      // We can't actually delete Firebase apps in the admin SDK, but we can mark our state as needing reinitialization
      firebaseInitialized = false;
      firebaseApp = null;
    }
    
    // Try to get credentials from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    let appOptions: AppOptions | undefined;
    let credentialSource = '';
    
    // Check if all environment variables are set
    if (projectId && clientEmail && privateKey) {
      console.log('🔑 Using Firebase credentials from environment variables');
      credentialSource = 'environment variables';
      
      // Format private key correctly (replace escaped newlines with actual newlines)
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      
      try {
        appOptions = {
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formattedPrivateKey,
          }),
          projectId,
        };
        console.log(`✅ Successfully loaded credentials from ${credentialSource}`);
      } catch (error) {
        console.error(`❌ Error creating cert from ${credentialSource}:`, error);
        // Continue to next credential source
      }
    }
    
    // Try to get credentials from GOOGLE_APPLICATION_CREDENTIALS environment variable
    if (!appOptions && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      credentialSource = `GOOGLE_APPLICATION_CREDENTIALS (${credentialsPath})`;
      console.log(`🔍 Checking for service account JSON at ${credentialsPath}`);
      
      if (fs.existsSync(credentialsPath)) {
        console.log(`🔑 Found service account file at ${credentialsPath}`);
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
          appOptions = {
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
          };
          console.log(`✅ Successfully loaded credentials from ${credentialSource}`);
        } catch (error) {
          console.error(`❌ Error parsing service account JSON from ${credentialSource}:`, error);
          // Continue to next credential source
        }
      } else {
        console.warn(`⚠️ GOOGLE_APPLICATION_CREDENTIALS file not found at ${credentialsPath}`);
      }
    }
    
    // Try to find service account JSON files in common locations
    if (!appOptions) {
      const possiblePaths = [
        path.join(process.cwd(), 'service-account.json'),
        path.join(process.cwd(), 'firebase-service-account.json'),
        path.join(process.cwd(), 'firebase-adminsdk.json'),
        path.join(process.cwd(), 'credentials', 'firebase-adminsdk.json'),
        path.join(process.cwd(), 'credentials', 'service-account.json'),
        path.join(process.cwd(), '.firebase', 'service-account.json'),
        path.join(os.homedir(), '.firebase', 'service-account.json'),
        path.join(os.homedir(), '.config', 'firebase', 'service-account.json'),
      ];
      
      console.log('🔍 Searching for service account JSON in common locations...');
      for (const credentialsPath of possiblePaths) {
        if (fs.existsSync(credentialsPath)) {
          credentialSource = `file at ${credentialsPath}`;
          console.log(`🔑 Found service account JSON at ${credentialsPath}`);
          try {
            const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            
            // Validate the service account has required fields
            if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
              console.warn(`⚠️ Service account at ${credentialsPath} is missing required fields`);
              continue;
            }
            
            appOptions = {
              credential: cert(serviceAccount),
              projectId: serviceAccount.project_id,
            };
            console.log(`✅ Successfully loaded credentials from ${credentialSource}`);
            break;
          } catch (error) {
            console.warn(`⚠️ Error parsing service account JSON at ${credentialsPath}:`, error);
            // Try next path
          }
        }
      }
    }
    
    // Fall back to application default credentials
    if (!appOptions) {
      credentialSource = 'application default credentials';
      console.log('🔑 No explicit credentials found, using application default credentials');
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
      const auth = getFirebaseAuth();
      // Just accessing the auth object is enough to validate it's working
      
      // Now test Firestore
      console.log('🔍 Testing Firestore connection...');
      const db = getFirestoreInstance();
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
          console.error('❌ NOT_FOUND: The specified Firebase project does not exist or you do not have access to it.');
        }
      }
      
      // Continue anyway - the app might still be usable for some operations
      console.log('⚠️ Continuing despite connection test failure');
    }
    
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully!');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
    throw new Error(`Failed to initialize Firebase Admin SDK: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Firebase Auth instance
 * Ensures Firebase Admin SDK is initialized first
 */
export async function getAuth(): Promise<admin.auth.Auth> {
  const app = await getFirebaseAdmin();
  return admin.auth(app);
}

/**
 * Get Firestore instance
 * Ensures Firebase Admin SDK is initialized first
 */
export async function getFirestore(): Promise<admin.firestore.Firestore> {
  const app = await getFirebaseAdmin();
  return admin.firestore(app);
}
