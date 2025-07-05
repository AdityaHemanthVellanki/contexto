# Contexto: Firebase Migration Guide

This document outlines the migration of Contexto from Supabase to Firebase for authentication, data storage, and serverless functions.

## ⚠️ Troubleshooting: Firebase API Key Error

If you're seeing the error `FirebaseError: Firebase: Error (auth/invalid-api-key)`, follow these steps to fix it:

## Overview

The following components have been migrated:

1. **Authentication**: Firebase Authentication (Google & Email/Password)
2. **Data Storage**: Firestore collections for pipelines and usage metrics
3. **Backend Functions**: Firebase Cloud Functions for API endpoints
4. **Frontend Integration**: React components and hooks updated to use Firebase

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file at the root of your project with the following Firebase configuration:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

**Important:** After creating this file, you must restart your development server for the changes to take effect:

```bash
# Stop the current server (Ctrl+C) and then run:
npm run dev
```

### 2. Firebase Project Setup

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication with Google and Email/Password providers
3. Create a Firestore database in Native mode
4. Set up Security Rules for Firestore (see below)

### 3. Firebase Functions Deployment

Deploy the Firebase Functions:

```bash
cd functions
npm install
npm run deploy
```

### 4. Firestore Security Rules

Add these security rules to your Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Pipelines collection
    match /pipelines/{pipelineId} {
      // Only allow read/write if user is authenticated and owns the pipeline
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      // Allow creation if user is authenticated and sets their user ID
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // Usage metrics collection
    match /usage_metrics/{metricId} {
      // Only allow read if user is authenticated and the metric belongs to them
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      // Allow creation if user is authenticated and sets their user ID
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

## Architecture Changes

### Authentication

We've replaced the Supabase authentication context with Firebase Authentication. The new implementation includes:

- Google sign-in with popup
- Email/password sign-in and sign-up
- Auth state listener with `onAuthStateChanged`
- Sign-out functionality

### Data Persistence

Data is now stored in Firestore collections:

- **pipelines**: User's pipelines with graph data
- **usage_metrics**: Usage logging for API calls

### Firebase Functions

API endpoints are now implemented as Firebase Functions:

- `GET /pipelines` - List user's pipelines
- `GET /pipelines/:id` - Get a specific pipeline
- `POST /pipelines` - Create/update a pipeline
- `DELETE /pipelines/:id` - Soft delete a pipeline
- `POST /usage` - Log usage metrics
- `POST /pipelines/:id/run` - Execute a pipeline

## Known Issues

None currently.

## Future Improvements

1. Add Firebase Storage for file uploads
2. Implement more advanced Firebase Functions for pipeline execution
3. Add Firebase Analytics for usage tracking
