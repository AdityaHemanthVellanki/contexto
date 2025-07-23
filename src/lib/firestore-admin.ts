import * as admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Firestore admin singleton implementation
 * This module initializes Firebase Admin and Firestore once at the module level
 * and applies settings() only once to prevent "already initialized" errors
 */

// Global module-level variables for singleton pattern
let _firestoreInstance: Firestore | undefined = undefined;

/**
 * Initialize Firebase Admin SDK if not already initialized
 * This is safe to call multiple times as it checks for existing apps
 */
function initializeFirebaseAdmin(): void {
  // Skip if already initialized
  if (admin.apps.length > 0) {
    return;
  }
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n') || ''
      })
    });
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error instanceof Error ? error.message : String(error));
  }
}

// Initialize Firebase Admin at module level
initializeFirebaseAdmin();

/**
 * Get the Firestore instance - true singleton implementation
 * This ensures settings() is only called once per Node.js process
 */
export function getFirestoreAdmin(): Firestore {
  // Return existing instance if available
  if (_firestoreInstance) {
    return _firestoreInstance;
  }
  
  try {
    // Ensure Firebase is initialized
    if (admin.apps.length === 0) {
      initializeFirebaseAdmin();
    }
    
    // Get Firestore instance without applying settings yet
    const db = admin.firestore();
    
    // Only apply settings if this is the first time getting Firestore
    // We use a try-catch because settings() will throw if already called
    try {
      db.settings({
        ignoreUndefinedProperties: true
      });
      console.log('✅ Firestore settings applied successfully');
    } catch (settingsError) {
      // If settings were already applied, just log and continue
      console.log('ℹ️ Firestore settings already applied (this is normal)');
    }
    
    // Store instance for future calls
    _firestoreInstance = db;
    console.log('✅ Firestore admin singleton initialized');
    
    return db;
  } catch (error) {
    console.error('❌ Firestore initialization error:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to initialize Firestore: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Initialize the singleton at module level
const firestoreDb = getFirestoreAdmin();

/**
 * Export the singleton Firestore instance directly
 * This maintains backward compatibility with existing code
 */
export const firestore = firestoreDb;
