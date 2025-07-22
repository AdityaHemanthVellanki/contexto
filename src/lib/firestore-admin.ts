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
  try {
    // First ensure Firebase Admin is initialized with proper credentials
    await getFirebaseAdmin();
    
    // If already initialized, return the instance after validation
    if (firestoreInitialized && firestoreInstance) {
      try {
        // Quick validation to ensure the instance is still working
        await firestoreInstance.collection('_validation').doc('test').get();
        return firestoreInstance;
      } catch (validationError) {
        console.warn('Existing Firestore instance appears invalid, reinitializing...', validationError);
        // Continue with reinitialization
      }
    }
    
    // Get Firestore instance directly
    firestoreInstance = getFirestore();
    
    // Apply settings - use a try/catch to handle the case where settings are already applied
    try {
      // Configure Firestore with production-ready settings
      firestoreInstance.settings({
        ignoreUndefinedProperties: true,
        // Ensure we're connecting to the real Firestore (not emulator)
        host: 'firestore.googleapis.com',
        ssl: true
      });
      console.log('✅ Firestore settings applied successfully');
    } catch (settingsError) {
      // This is likely because settings were already applied
      console.log('⚠️ Could not apply Firestore settings:', settingsError);
      console.log('Continuing with existing settings');
    }
    
    // Verify the connection is working
    try {
      // Test with a simple read operation first
      await firestoreInstance.collection('_validation').listDocuments();
      console.log('✅ Firestore connection verified');
    } catch (connectionError) {
      console.error('⚠️ Firestore connection verification failed:', connectionError);
      console.log('This may indicate permission issues with your Firebase credentials');
      // Continue anyway, as this might be a permissions issue with the test collection
    }
    
    firestoreInitialized = true;
    return firestoreInstance;
  } catch (error) {
    console.error('❌ Error initializing Firestore admin:', error);
    // Re-throw but with a more descriptive message
    throw new Error(`Failed to initialize Firestore admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
