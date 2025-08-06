import { logUsage } from '../usage';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Import Jest types properly
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';

// Reference to original firestore add method for spying
let firestoreAddSpy: any;
let firestoreCollectionSpy: any;

// Use a dedicated test collection to avoid contaminating real data
const TEST_COLLECTION = 'usage_metrics_test';

describe('Usage Service', () => {
  let db: Firestore;
  
  beforeAll(async () => {
    // Initialize real Firebase Admin SDK for testing
    const firebaseAdmin = await getFirebaseAdmin();
    db = firebaseAdmin.firestore();
    
    // Create a test document to verify connection works
    try {
      await db.collection(TEST_COLLECTION).add({
        testSetup: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('Test Firestore connection established successfully');
    } catch (error) {
      console.error('Error establishing Firestore connection:', error);
      throw new Error('Failed to connect to Firestore - check credentials');
    }
  });
  
  beforeEach(() => {
    // Spy on Firestore methods instead of mocking them
    firestoreAddSpy = jest.spyOn(admin.firestore.CollectionReference.prototype, 'add');
    firestoreCollectionSpy = jest.spyOn(admin.firestore(), 'collection');
    
    // Make the spies return resolved promises to prevent actual writes during tests
    firestoreAddSpy.mockResolvedValue({ id: 'test-usage-id' });
  });
  
  afterEach(() => {
    // Clean up spies
    firestoreAddSpy.mockRestore();
    firestoreCollectionSpy.mockRestore();
  });
  
  afterAll(async () => {
    // Clean up test collection
    try {
      const testDocs = await db.collection(TEST_COLLECTION).limit(100).get();
      const batch = db.batch();
      testDocs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('Test documents cleaned up successfully');
    } catch (error) {
      console.warn('Error cleaning up test documents:', error);
    }
  });
  
  describe('logUsage', () => {
    it('should log usage metrics correctly', async () => {
      // Arrange
      const callType = 'embedding';
      const usage = { promptTokens: 100, completionTokens: 50 };
      const userId = 'test-user-123';
      
      // Act
      await logUsage(callType, usage, userId);
      
      // Assert
      expect(firestoreCollectionSpy).toHaveBeenCalled();
      expect(firestoreAddSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        callType,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.promptTokens + usage.completionTokens,
        environment: 'server'
      }));
    });
    
    it('handles missing parameters gracefully', async () => {
      // Arrange
      const callType = '';
      const usage = { promptTokens: 100, completionTokens: 50 };
      const userId = 'test-user-123';
      
      // Act
      await logUsage(callType, usage, userId);
      
      // Should log warning but not throw
      expect(firestoreAddSpy).not.toHaveBeenCalled();
    });
    
    it('handles invalid usage metrics gracefully', async () => {
      // Arrange
      const callType = 'embedding';
      const usage = { promptTokens: null as any, completionTokens: 50 };
      const userId = 'test-user-123';
      
      // Act
      await logUsage(callType, usage, userId);
      
      // Should log warning but not throw
      expect(firestoreAddSpy).not.toHaveBeenCalled();
    });
    
    it('handles missing user ID gracefully', async () => {
      // Arrange
      const callType = 'embedding';
      const usage = { promptTokens: 100, completionTokens: 50 };
      const userId = '';
      
      // Act
      await logUsage(callType, usage, userId);
      
      // Should log warning but not throw
      expect(firestoreAddSpy).not.toHaveBeenCalled();
    });
  });
});
