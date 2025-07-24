/**
 * Shared Firebase Admin initialization module for API routes
 * This ensures Firebase Admin is properly initialized in serverless functions
 * 
 * IMPORTANT: This module uses a simple, robust approach to Firebase Admin initialization
 * that works reliably in serverless environments like Next.js API routes.
 */
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Module-level variables to track initialization state
let firestore: Firestore | null = null;

/**
 * Initialize Firebase Admin and get Firestore instance
 * Safe to call multiple times - will reuse existing instance
 */
export function initializeFirebaseAdmin(): Firestore {
  // Check if Firebase Admin is already initialized
  if (firestore) {
    console.log('✅ Using existing Firestore instance');
    return firestore;
  }

  try {
    // Check if Firebase credentials are configured
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
      console.error('❌ Firebase credentials not properly configured');
      throw new Error('Firebase credentials not properly configured');
    }

    // Format the private key correctly (replace escaped newlines)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    // Initialize Firebase Admin if not already initialized
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      console.log('ℹ️ Firebase Admin SDK already initialized');
    }
    
    // Get Firestore instance
    firestore = getFirestore();
    
    // Apply settings
    firestore.settings({
      ignoreUndefinedProperties: true
    });
    
    console.log('✅ Firestore instance initialized');
    return firestore;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', 
      error instanceof Error ? error.message : String(error));
    throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get Firebase Auth instance
 * Ensures Firebase Admin is initialized first
 */
export function getFirebaseAuth() {
  // Initialize Firebase Admin if needed
  initializeFirebaseAdmin();
  
  // Return Auth instance
  return getAuth();
}

// Log environment variables for debugging
console.log('🔍 Firebase environment variables check:');
console.log('- FIREBASE_PROJECT_ID present:', !!process.env.FIREBASE_PROJECT_ID);
console.log('- FIREBASE_CLIENT_EMAIL present:', !!process.env.FIREBASE_CLIENT_EMAIL);
console.log('- FIREBASE_PRIVATE_KEY present:', !!process.env.FIREBASE_PRIVATE_KEY);

// Initialize Firebase Admin at module load time
try {
  initializeFirebaseAdmin();
  console.log('✅ Firebase Admin SDK initialized successfully at module load');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK at module load:', 
    error instanceof Error ? error.message : String(error));
  // Don't throw here - let individual API routes handle initialization
}

/**
 * Get the Firestore instance, initializing Firebase Admin if needed
 */
export function getFirestoreInstance(): Firestore {
  return initializeFirebaseAdmin();
}
