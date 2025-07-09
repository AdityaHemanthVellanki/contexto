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

  // Detect environment
  const isDev = process.env.NODE_ENV === 'development';
  const isDevAuthBypass = process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_BYPASS === 'true';

  // Configure emulators if needed
  configureFirebaseAdminEmulators();
  
  try {
    // For local development, use the Firebase project ID from environment variables
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'contexto-app';
    
    // DEVELOPMENT MODE WITH AUTH BYPASS
    // If we're in dev mode and auth bypass is enabled, use a minimal configuration
    if (isDev && isDevAuthBypass) {
      console.log('DEV MODE: Initializing Firebase Admin with minimal config for auth bypass');
      admin.initializeApp({
        projectId: projectId
      });
      return admin;
    }
    
    // Check if we have a service account JSON
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId,
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        console.log('Firebase Admin SDK initialized with service account');
      } catch (e) {
        console.error('Error parsing service account JSON:', e);
        
        if (isDev) {
          // For development, use a minimal config if service account fails
          console.log('DEV MODE: Falling back to application default credentials');
          admin.initializeApp({
            projectId: projectId
          });
        } else {
          throw new Error('Invalid service account JSON in production environment');
        }
      }
    } else {
      // For local development without service account
      console.log(isDev ? 'DEV MODE: No service account, using minimal configuration' : 'WARNING: Missing service account in production');
      admin.initializeApp({
        projectId: projectId
      });
    }
    
    return admin;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    
    if (isDev) {
      console.warn('DEV MODE: Creating minimal Firebase Admin instance after error');
      // Last resort for development - create a minimal instance
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'contexto-dev'
        });
      }
    } else {
      // In production, we should not continue without proper initialization
      throw new Error(`Firebase Admin initialization failed: ${error}`);
    }
    
    return admin;
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
