import { getFirestore, Firestore, Settings } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from './firebase-admin';
import * as admin from 'firebase-admin';

// Variable to track initialization status
let firestoreInitialized = false;
let firestoreInstance: Firestore;

/**
 * Get a Firestore instance with ignoreUndefinedProperties enabled
 * This prevents errors when undefined values are passed to Firestore
 * Uses a singleton pattern to ensure settings() is called only once
 */
export async function getFirestoreAdmin(): Promise<Firestore> {
  // If already initialized, return the instance
  if (firestoreInitialized && firestoreInstance) {
    return firestoreInstance;
  }
  
  try {
    // First ensure Firebase Admin is initialized
    await getFirebaseAdmin();
    
    // Get Firestore instance directly
    firestoreInstance = getFirestore();
    
    // Apply settings
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
    
    firestoreInitialized = true;
    return firestoreInstance;
  } catch (error) {
    console.error('Error initializing Firestore admin:', error);
    // Re-throw but with a more descriptive message
    throw new Error(`Failed to initialize Firestore admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
