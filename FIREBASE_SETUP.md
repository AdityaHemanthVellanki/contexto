# Firebase Setup for Production Deployment

This document outlines the steps required to set up Firebase for production deployment of Contexto.

## Firebase Admin SDK Setup

To ensure proper Firebase Admin SDK authentication in production, follow these steps:

1. **Create a Firebase project** in the [Firebase Console](https://console.firebase.google.com/) if you don't already have one.

2. **Generate a Service Account key**:
   - Navigate to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely
   - Replace the mock `service-account.json` in the project root with this file

3. **Set environment variables** (alternative to service account file):
   - Add the following to your `.env` file or deployment environment:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-client-email@project-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nMulti-line\nPrivate\nKey\n-----END PRIVATE KEY-----\n"
   ```

4. **Configure Firebase Authentication**:
   - Enable Email/Password authentication
   - Enable Google authentication
   - Set up any other authentication providers as needed

5. **Deploy Firestore Security Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Firestore Database Setup

1. **Create a Firestore database** in Native mode (not Datastore mode).

2. **Configure the security rules** in `firestore.rules` to enforce:
   - User authentication (`request.auth.uid != null`)
   - Data ownership (`request.auth.uid == resource.data.userId`)
   - Multi-user isolation

3. **Index setup** for production performance:
   ```bash
   firebase deploy --only firestore:indexes
   ```

## Firebase Project Configuration for Client

Ensure your `src/lib/firebase.ts` contains the real Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};
```

Add these values to your `.env` file and deployment environment.

## Testing Production Configuration

To test your Firebase configuration with real credentials:

1. Ensure all environment variables are set
2. Place your real `service-account.json` in the project root
3. Run the production demo:
   ```bash
   node production-demo.js
   ```

This will verify that your Firebase Admin SDK authentication, Firestore operations, and security rules are functioning correctly with real production credentials.

## Important Security Notes

1. **Never commit** your real `service-account.json` or `.env` file to version control
2. Keep Firebase Admin SDK credentials **server-side only**
3. Use `NEXT_PUBLIC_` prefix only for non-sensitive client-side configuration
4. Implement proper Firebase ID token verification on all API routes
5. Follow the principle of least privilege for service accounts
