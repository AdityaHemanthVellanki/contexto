/**
 * Firebase Admin SDK debug utilities
 * Helps identify and resolve permission issues
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Debug Firebase Admin initialization and perform a test write
 * to identify permission issues
 */
export async function debugFirebaseAdmin(userId: string): Promise<string> {
  try {
    // Check if Firebase Admin SDK is already initialized
    const alreadyInitialized = admin.apps.length > 0;
    
    console.log(`Firebase Admin SDK status: ${alreadyInitialized ? 'Already initialized' : 'Not initialized'}`);
    
    // If not initialized, explicitly initialize with service account
    if (!alreadyInitialized) {
      // Try to load service account from different possible locations
      let serviceAccount: any;
      
      // First try environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          console.log('Using service account from FIREBASE_SERVICE_ACCOUNT environment variable');
        } catch (e) {
          console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
        }
      }
      
      // Then try individual credential variables
      if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && 
          process.env.FIREBASE_CLIENT_EMAIL && 
          process.env.FIREBASE_PRIVATE_KEY) {
        serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
        console.log('Using service account from individual environment variables');
      }
      
      // Finally fall back to service-account.json file
      if (!serviceAccount) {
        try {
          const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
          if (fs.existsSync(serviceAccountPath)) {
            const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
            serviceAccount = JSON.parse(fileContent);
            console.log('Using service account from service-account.json file');
            
            // Check if this appears to be a mock service account
            if (serviceAccount.project_id === 'contexto-local-dev' || 
                serviceAccount.private_key_id === 'mock-key-id-for-local-development') {
              console.warn('WARNING: Using a mock service account - this will cause permission errors in production');
            }
          } else {
            console.error('service-account.json file not found');
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          console.error('Failed to load service account from file:', errorMessage);
        }
      }
      
      // Initialize with the service account if found
      if (serviceAccount) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          console.log('Successfully initialized Firebase Admin SDK');
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          console.error('Failed to initialize Firebase Admin SDK:', errorMessage);
          return `Firebase Admin initialization error: ${errorMessage}`;
        }
      } else {
        return 'Failed to find valid service account credentials';
      }
    }
    
    // Attempt a test write to diagnose permissions
    try {
      const db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      
      const testDocId = `test_permission_${Date.now()}`;
      
      console.log(`Attempting test write to debug_logs/${testDocId} for userId: ${userId}`);
      
      await db.collection('debug_logs').doc(testDocId).set({
        userId,
        message: 'Firebase Admin SDK test write',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('Test write succeeded - Admin SDK is working correctly');
      
      return 'Admin SDK initialized successfully with write permissions';
    } catch (e: unknown) {
      console.error('Test write failed:', e);
      return `Permission error during test write: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  } catch (e: unknown) {
    console.error('Debug function error:', e);
    return `Unexpected error in debug function: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}
