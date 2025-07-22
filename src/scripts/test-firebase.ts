/**
 * Test script for Firebase Admin SDK initialization and Firestore permissions
 * Run with: npx tsx src/scripts/test-firebase.ts
 */

import { getFirebaseAdmin } from '../lib/firebase-admin';
import { getFirestoreAdmin } from '../lib/firestore-admin';

async function testFirebaseAdmin() {
  console.log('🔍 Testing Firebase Admin SDK initialization...');
  
  try {
    // Initialize Firebase Admin SDK
    console.log('Initializing Firebase Admin...');
    await getFirebaseAdmin();
    console.log('✅ Firebase Admin initialized successfully!');
    
    // Initialize Firestore Admin
    console.log('\nInitializing Firestore Admin...');
    const db = await getFirestoreAdmin();
    console.log('✅ Firestore Admin initialized successfully!');
    
    // Test Firestore read operation
    console.log('\nTesting Firestore read operation...');
    const testCollection = db.collection('_test_collection');
    const docs = await testCollection.listDocuments();
    console.log('✅ Read operation successful!', docs.length, 'documents found');
    
    // Test Firestore write operation
    console.log('\nTesting Firestore write operation...');
    const testDocRef = testCollection.doc('test_' + Date.now());
    await testDocRef.set({
      timestamp: new Date(),
      test: 'Firebase Admin SDK test'
    });
    console.log('✅ Write operation successful!');
    
    // Test Firestore read after write
    console.log('\nTesting Firestore read after write...');
    const docSnapshot = await testDocRef.get();
    if (docSnapshot.exists) {
      console.log('✅ Document exists after write!');
      console.log('Document data:', docSnapshot.data());
    } else {
      console.log('❌ Document does not exist after write!');
    }
    
    // Clean up test document
    console.log('\nCleaning up test document...');
    await testDocRef.delete();
    console.log('✅ Test document deleted successfully!');
    
    console.log('\n🎉 All Firebase Admin SDK tests passed!');
  } catch (error) {
    console.error('\n❌ Error testing Firebase Admin SDK:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testFirebaseAdmin();
