import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Check for required Firebase environment variables
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY environment variable');
}

if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN environment variable');
}

if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable');
}

if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable');
}

if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID environment variable');
}

if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_APP_ID environment variable');
}

// Firebase configuration with strict required values
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

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
