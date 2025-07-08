import * as admin from 'firebase-admin';
import { cert } from 'firebase-admin/app';
import { configureFirebaseAdminEmulators } from './firebase-emulator';

/**
 * Initialize Firebase Admin SDK
 * Uses environment variables for configuration
 */
export function getFirebaseAdmin() {
  // Configure emulators if needed
  configureFirebaseAdminEmulators();
  
  if (!admin.apps.length) {
    try {
      // For local development, use the Firebase project ID from environment variables
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'contexto-app';
      
      // Check if we have a service account JSON
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId,
            databaseURL: process.env.FIREBASE_DATABASE_URL
          });
        } catch (e) {
          console.error('Error parsing service account JSON:', e);
          throw new Error('Invalid service account JSON');
        }
      } else {
        // For local development without service account
        admin.initializeApp({
          projectId: projectId
        });
      }
      
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
