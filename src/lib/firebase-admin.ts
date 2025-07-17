import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert, AppOptions } from 'firebase-admin/app';
import { debugEnvironment } from './env-debug';
import { getFirebaseAdminConfig } from './firebase-admin-config';

/**
 * Initialize Firebase Admin SDK
 * Uses configuration from environment variables or firebase-admin-config helper
 */
export function getFirebaseAdmin() {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length > 0) {
    return admin;
  }
  
  // Print environment debug information to help troubleshoot
  debugEnvironment();
  console.log('Firebase Admin initialization - Environment check');
  
  // Get admin configuration with fallbacks
  const config = getFirebaseAdminConfig();
  
  // Detailed logging for troubleshooting
  console.log(`Firebase Project ID: ${config.projectId ? 'Found' : 'Missing'}`);
  console.log(`Firebase Client Email: ${config.clientEmail ? 'Found' : 'Missing'}`);
  console.log(`Firebase Private Key: ${config.privateKey ? 'Found (length: ' + config.privateKey.length + ')' : 'Missing'}`);
  
  // Try to handle missing variables gracefully
  if (!config.projectId) {
    console.error('Firebase project ID is missing. Please check your environment configuration.');
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      console.log('Falling back to NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
      config.projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    } else {
      throw new Error('Firebase project ID is required but not available in any configuration.');
    }
  }
  
  try {
    // For development environment, we can use the Firebase emulators
    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      console.log('Using Firebase emulator for development');
      process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
      process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
      
      admin.initializeApp({
        projectId: config.projectId
      });
      
      console.log('Firebase Admin SDK initialized with emulator settings');
      return admin;
    }
    
    // For production, we need proper credentials
    if (!config.clientEmail || !config.privateKey) {
      console.error('Firebase Admin SDK credentials incomplete:');
      console.error('- Client Email:', config.clientEmail ? 'Present' : 'Missing');
      console.error('- Private Key:', config.privateKey ? 'Present' : 'Missing');
      
      // Special case for Vercel/Netlify/etc. where we might need to parse private key differently
      if (process.env.FIREBASE_PRIVATE_KEY && !config.privateKey) {
        config.privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        console.log('Reformatted private key from environment variable');
      } else if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && !process.env.FIREBASE_PRIVATE_KEY) {
        // Try creating a temporary application configuration for simple operations
        // This won't have full admin privileges but might work for some operations
        console.log('Creating temporary app configuration with limited functionality');
        admin.initializeApp({
          projectId: config.projectId
        });
        console.warn('⚠️ Firebase Admin initialized WITHOUT admin credentials. Some operations may fail.');
        return admin;
      } else {
        throw new Error('Firebase Admin SDK requires valid client email and private key.');
      }
    }
    
    // Initialize Firebase Admin with explicit credentials
    admin.initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey
      }),
      storageBucket: config.storageBucket || `${config.projectId}.appspot.com` // Use config bucket or default
    });
    
    // Log the configured storage bucket for debugging
    console.log(`Firebase Admin initialized with bucket: ${config.storageBucket || `${config.projectId}.appspot.com`}`);
    
    console.log('Firebase Admin SDK initialized successfully');
    return admin;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get Firestore database instance
 */
export function getFirestore() {
  return getFirebaseAdmin().firestore();
}

/**
 * Get Firebase Auth instance
 */
export function getAuth() {
  return getFirebaseAdmin().auth();
}
