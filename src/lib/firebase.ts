import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Define required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

// For development mode, show warnings instead of throwing errors
const isDevelopment = process.env.NODE_ENV === 'development';
const missingVars: string[] = [];

// Check for missing environment variables
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    if (!isDevelopment) {
      throw new Error(`Missing ${varName} environment variable`);
    }
  }
});

// Show warning in development mode
if (isDevelopment && missingVars.length > 0) {
  console.warn(`
    ⚠️ Missing Firebase environment variables: ${missingVars.join(', ')}.
    Using placeholder values for development.
    Please set these in .env.local for proper functionality.
  `);
}

// Firebase configuration with fallbacks for development
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key-for-development',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000'
};

// Add warning if we're using demo values in development
if (isDevelopment && missingVars.length > 0) {
  console.log('🔥 Using demo Firebase configuration for development');
  console.log('🔥 Some features may be limited or unavailable');
}

// Initialize Firebase (singleton pattern)
let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firebaseDb: Firestore;

// Ensure we only initialize Firebase once
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

// Initialize services
firebaseAuth = getAuth(firebaseApp);
firebaseDb = getFirestore(firebaseApp);

// Export the Firebase services
export const app = firebaseApp;
export const auth = firebaseAuth;
export const db = firebaseDb;

// Default export for convenience
export default { app, auth, db };
