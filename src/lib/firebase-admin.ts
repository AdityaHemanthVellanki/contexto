import * as admin from 'firebase-admin';

/**
 * Initialize Firebase Admin SDK
 * Uses environment variables for configuration
 */
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      // Initialize with service account if provided, otherwise use default credentials
      // In production, ensure FIREBASE_SERVICE_ACCOUNT environment variable is properly set
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : undefined;
      
      admin.initializeApp({
        credential: serviceAccount 
          ? admin.credential.cert(serviceAccount) 
          : admin.credential.applicationDefault(),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
      
      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
      throw new Error('Failed to initialize Firebase Admin');
    }
  }
  
  return admin;
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
