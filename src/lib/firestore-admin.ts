import { getFirestore, Firestore, Settings } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from './firebase-admin';

// Initialize Firebase Admin at the module level
getFirebaseAdmin();

// Create and configure Firestore instance at the module level
// This ensures settings() is called only once and before any Firestore usage
let firestoreInstance: Firestore;

try {
  // Get Firestore instance
  firestoreInstance = getFirestore();
  
  // Apply settings once at the module level
  const firestoreSettings: Settings = {
    ignoreUndefinedProperties: true
  };
  
  // Only apply settings if not already initialized
  try {
    firestoreInstance.settings(firestoreSettings);
    console.log('Firestore settings applied successfully');
  } catch (error) {
    console.log('Firestore already initialized, settings not applied');
    // Settings already applied, this is fine
  }
} catch (error) {
  console.error('Error initializing Firestore admin:', error);
  // Re-throw but with a more descriptive message
  throw new Error(`Failed to initialize Firestore admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

/**
 * Get a Firestore instance with ignoreUndefinedProperties enabled
 * This prevents errors when undefined values are passed to Firestore
 * The instance is initialized at the module level to ensure settings() is called only once
 */
export function getFirestoreAdmin(): Firestore {
  return firestoreInstance;
}
