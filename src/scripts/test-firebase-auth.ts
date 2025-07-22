/**
 * Firebase Admin SDK Test Script
 * 
 * This script tests the Firebase Admin SDK initialization and authentication.
 * It attempts to:
 * 1. Initialize the Firebase Admin SDK
 * 2. Test Firebase Auth functionality
 * 3. Test Firestore connectivity
 * 4. Provide detailed error reporting
 */

import { getFirebaseAdmin, getAuth, getFirestore } from '../lib/firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testFirebaseAdmin() {
  console.log('🔍 Starting Firebase Admin SDK test...');
  
  try {
    // Step 1: Initialize Firebase Admin SDK
    console.log('\n📋 Step 1: Initializing Firebase Admin SDK...');
    const app = await getFirebaseAdmin();
    console.log(`✅ Firebase Admin SDK initialized successfully with project: ${app.options.projectId || 'unknown'}`);
    
    // Step 2: Test Firebase Auth
    console.log('\n📋 Step 2: Testing Firebase Auth...');
    const auth = await getAuth();
    console.log('✅ Firebase Auth initialized successfully');
    
    try {
      // Try to list users (limited to 1)
      console.log('   Attempting to list users...');
      const userListResult = await auth.listUsers(1);
      console.log(`✅ Successfully listed users. User count: ${userListResult.users.length}`);
    } catch (authError) {
      console.error('❌ Error listing users:', authError);
      console.log('⚠️ This may indicate permission issues with your Firebase credentials');
      console.log('⚠️ Make sure your service account has the Firebase Auth Admin role');
    }
    
    // Step 3: Test Firestore
    console.log('\n📋 Step 3: Testing Firestore...');
    const db = await getFirestore();
    console.log('✅ Firestore initialized successfully');
    
    try {
      // Try to read from a test collection
      console.log('   Attempting to read from test collection...');
      const testCollection = db.collection('_test_collection');
      const docs = await testCollection.limit(1).get();
      console.log(`✅ Successfully read from test collection. Documents found: ${docs.size}`);
      
      // Try to write to the test collection
      console.log('   Attempting to write to test collection...');
      const docRef = testCollection.doc('test_' + Date.now());
      await docRef.set({
        timestamp: new Date(),
        test: true
      });
      console.log('✅ Successfully wrote to test collection');
      
      // Read back the document
      const docSnapshot = await docRef.get();
      console.log('✅ Successfully read back the test document');
      
      // Delete the test document
      await docRef.delete();
      console.log('✅ Successfully deleted the test document');
    } catch (firestoreError) {
      console.error('❌ Error with Firestore operations:', firestoreError);
      console.log('⚠️ This may indicate permission issues with your Firebase credentials');
      console.log('⚠️ Make sure your service account has the Cloud Firestore Admin role');
      
      // Provide more detailed error information
      if (firestoreError instanceof Error) {
        if (firestoreError.message.includes('PERMISSION_DENIED')) {
          console.error('❌ PERMISSION DENIED: Your service account does not have the required permissions.');
          console.error('Please ensure your service account has the following roles:');
          console.error('  - Firebase Admin SDK Administrator Service Agent');
          console.error('  - Cloud Firestore Service Agent');
        } else if (firestoreError.message.includes('UNAUTHENTICATED')) {
          console.error('❌ UNAUTHENTICATED: Your credentials are invalid or expired.');
          console.error('Please check that your service account key is valid and has not been revoked.');
        }
      }
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testFirebaseAdmin().catch(error => {
  console.error('❌ Unhandled error during test:', error);
  process.exit(1);
});
