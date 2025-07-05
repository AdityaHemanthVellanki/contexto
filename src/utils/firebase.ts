import { initializeApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Validate that environment variables are set
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
    !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 
    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  console.error(`
    ⚠️ Missing required Firebase environment variables ⚠️
    
    Please create a .env.local file in the root directory with the following variables:
    
    NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
    NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
  `);
}

// For development, provide demo values if env variables are missing
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key-please-replace';
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com';
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project';

// Firebase configuration
const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
};

// Initialize Firebase (singleton pattern)
let app;
let auth: Auth;
let db: Firestore;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  
  // Initialize Firebase services
  auth = getAuth(app);
  db = getFirestore(app);
  
} catch (error) {
  console.error('Error initializing Firebase:', error);
  // Provide dummy objects to prevent the app from completely crashing
  auth = {} as any;
  db = {} as any;
}

// Export Firebase services
export { auth, db };
