import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert, AppOptions } from 'firebase-admin/app';
import { configureFirebaseAdminEmulators } from './firebase-emulator';

/**
 * Initialize Firebase Admin SDK
 * Uses environment variables for configuration with robust fallbacks for development
 */
export function getFirebaseAdmin() {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length > 0) {
    return admin;
  }

  // Configure emulators only in development environment
  if (process.env.NODE_ENV === 'development') {
    console.log('Firebase Admin initializing in development mode');
    if (process.env.FIREBASE_USE_EMULATORS === 'true') {
      configureFirebaseAdminEmulators();
    }
  }
  
  try {
    // Get project ID from environment variables - use public var as fallback
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Firebase project ID is required. Set FIREBASE_PROJECT_ID environment variable.');
    }
    
    const options: AppOptions = { projectId };
    let credentialSet = false;
    
    // Primary method: Use service account JSON from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        // Handle both stringified JSON and direct object format
        let serviceAccount: any;
        if (typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string') {
          try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          } catch (parseError) {
            // If it's not valid JSON, it might be a path to a file
            if (process.env.FIREBASE_SERVICE_ACCOUNT.endsWith('.json')) {
              // Treat as path to credential file
              options.credential = admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT);
              credentialSet = true;
            } else {
              throw new Error(`FIREBASE_SERVICE_ACCOUNT contains invalid JSON and is not a file path`);
            }
          }
        } else {
          serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        }
        
        // If we parsed the JSON but haven't set credentials yet
        if (!credentialSet && serviceAccount) {
          // Validate required service account fields
          if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
            throw new Error('Service account JSON is missing required fields (project_id, private_key, or client_email)');
          }
          
          options.credential = admin.credential.cert(serviceAccount);
          credentialSet = true;
        }
        
        if (process.env.FIREBASE_DATABASE_URL) {
          options.databaseURL = process.env.FIREBASE_DATABASE_URL;
        }
      } catch (e) {
        console.error('Error with FIREBASE_SERVICE_ACCOUNT:', e);
        // Don't throw yet - try other credential methods
      }
    } 
    
    // Secondary method: Use Google Application Default Credentials from path
    if (!credentialSet && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // This can be a path to a JSON file
        if (typeof process.env.GOOGLE_APPLICATION_CREDENTIALS === 'string' && 
            process.env.GOOGLE_APPLICATION_CREDENTIALS.endsWith('.json')) {
          options.credential = admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        } else {
          // Or it can be used with applicationDefault()
          options.credential = admin.credential.applicationDefault();
        }
        credentialSet = true;
      } catch (e) {
        console.error('Error with GOOGLE_APPLICATION_CREDENTIALS:', e);
        // Don't throw yet - try other credential methods
      }
    }
    
    // Tertiary method: Try to use application default credentials
    if (!credentialSet) {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('Creating mock credentials for local development');
          // Create mock credentials for local development
          options.credential = admin.credential.cert({
            projectId: 'contexto-local-dev',
            clientEmail: 'firebase-adminsdk-local@contexto-local-dev.iam.gserviceaccount.com',
            privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQCsXXjI5xQqp9wR\n-----END PRIVATE KEY-----\n'
          });
          credentialSet = true;
        } else {
          options.credential = admin.credential.applicationDefault();
          credentialSet = true;
        }
      } catch (e) {
        console.error('Error setting up Firebase Admin credentials:', e);
        if (process.env.NODE_ENV === 'development') {
          // In development, create mock credentials as last resort
          console.warn('Falling back to mock credentials for development');
          options.credential = admin.credential.cert({
            projectId: 'contexto-local-dev',
            clientEmail: 'firebase-adminsdk-local@contexto-local-dev.iam.gserviceaccount.com',
            privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQCsXXjI5xQqp9wR\n-----END PRIVATE KEY-----\n'
          });
          credentialSet = true;
        } else {
          // In production, we should fail if no credentials are available
          throw new Error(`No Firebase credentials found: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    
    // Final check before initialization
    if (!credentialSet || !options.credential) {
      throw new Error('Could not load Firebase Admin credentials from any source');
    }
    
    // Initialize the app
    try {
      admin.initializeApp(options);
    } catch (initError) {
      console.error('Error initializing Firebase Admin app:', initError);
      throw new Error(`Firebase Admin initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`);
    }
    
    // Verify connectivity to Firebase services
    try {
      // Test Firestore access - will throw if credentials are invalid
      const firestore = admin.firestore();
      
      // Optional: Perform a simple test query to verify connectivity
      // This isn't necessary but helps catch connection issues early
      if (process.env.VERIFY_FIRESTORE_CONNECTION === 'true') {
        // We don't need to await this, just checking if it throws
        firestore.collection('_connection_test').limit(1).get();
      }
      
      // If we got here, initialization was successful
      return admin;
    } catch (verifyError) {
      console.error('Failed to verify Firebase services access:', verifyError);
      throw new Error(`Firebase Admin services verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`);
    }
  } catch (error) {
    // Log detailed error information
    console.error('Failed to initialize Firebase Admin SDK:', error);
    
    // Never continue without proper initialization
    throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : String(error)}. ` + 
      'Please ensure Firebase service account credentials are properly configured. ' +
      'Set either FIREBASE_SERVICE_ACCOUNT environment variable with the JSON content, ' +
      'or GOOGLE_APPLICATION_CREDENTIALS pointing to your service account file.');
  }
}

/**
 * Get Firestore database instance
 */
export function getFirestore() {
  return getFirebaseAdmin().firestore();
}

/**
 * Get Firebase Auth instance
 */
export function getAuth() {
  return getFirebaseAdmin().auth();
}
