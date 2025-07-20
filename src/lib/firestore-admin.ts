import { getFirestore, Firestore, Settings } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from './firebase-admin';

/**
 * Get a Firestore instance with ignoreUndefinedProperties enabled
 * This prevents errors when undefined values are passed to Firestore
 */
export function getFirestoreAdmin(): Firestore {
  // Initialize Firebase Admin if not already initialized
  getFirebaseAdmin();
  
  // Get Firestore instance with ignoreUndefinedProperties enabled
  const firestoreSettings: Settings = {
    ignoreUndefinedProperties: true
  };
  
  const db = getFirestore();
  db.settings(firestoreSettings);
  
  return db;
}
