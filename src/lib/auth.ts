import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Initialize Firebase Admin SDK if not already initialized
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    try {
      // Option 1: Using JSON credentials string in environment variable (recommended for production cloud environments)
      if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          console.log('Firebase Admin initialized with credentials from environment variable');
        } catch (parseError) {
          console.error('Error parsing FIREBASE_ADMIN_CREDENTIALS JSON:', parseError);
          throw new Error('Invalid Firebase Admin credentials format');
        }
      } 
      // Option 2: Using credentials file path
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
        console.log('Firebase Admin initialized with credentials file');
      } 
      // Option 3: Production environment detection with project ID for Google Cloud default credentials
      else if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        try {
          // When running on Google Cloud, default credentials are auto-detected
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
          });
          console.log('Firebase Admin initialized with default Google Cloud credentials');
        } catch (cloudError) {
          console.error('Failed to initialize with Google Cloud credentials:', cloudError);
          throw new Error('Firebase Admin initialization failed');
        }
      } 
      // No valid credentials found
      else {
        throw new Error('Firebase Admin credentials not found. Set FIREBASE_ADMIN_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS in your .env file');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      throw new Error('Failed to initialize Firebase Admin');
    }
  }
  return admin;
}

/**
 * Verifies a Firebase ID token
 * @param token The Firebase ID token to verify
 * @returns A Promise resolving to the decoded token
 * @throws If the token is invalid
 */
export async function verifyIdToken(token: string) {
  try {
    const app = initializeFirebaseAdmin();
    return await app.auth().verifyIdToken(token);
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw new Error('Invalid authentication token');
  }
}

/**
 * Gets the current user from the Firebase ID token
 * @param token The Firebase ID token
 * @returns A Promise resolving to the user ID
 * @throws If the token is invalid or no user is found
 */
export async function getUserFromToken(token: string) {
  try {
    const decodedToken = await verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    throw new Error('Failed to authenticate user');
  }
}
