# Firebase Security Implementation

## Overview

This document outlines the comprehensive security implementation for Firebase Firestore in the Contexto application. The security model ensures proper authentication, authorization, and data protection across all operations.

## Key Components

### 1. Firestore Security Rules

The security rules implement a strict, hierarchical permission model with the following principles:

- **Deny All by Default**: All access is denied unless explicitly allowed
- **User Ownership**: Documents can only be accessed by their owners
- **Operation Specificity**: Each CRUD operation is explicitly defined
- **Hierarchical Structure**: Permissions cascade through collection hierarchies

### 2. Server-Side Firebase Admin SDK

- **Async Initialization**: Properly initialized Firebase Admin SDK
- **Credential Validation**: Environment variables are validated before use
- **Connection Testing**: Admin SDK connections are tested during initialization
- **No Mock Credentials**: Production-ready implementation with no fallbacks

### 3. API Authentication

- **ID Token Verification**: Firebase ID tokens are verified on each request
- **Token Refresh**: Tokens are validated with the refresh check enabled
- **User Validation**: User ID is extracted and verified from each token
- **Consistent Error Responses**: Structured error messages for auth failures

### 4. Client-Side Security

- **SecureApiClient**: Routes all sensitive operations through authenticated APIs
- **SecureFirestore**: Enforces API usage for protected collections
- **Error Handling**: Client-side handling of permission and auth errors
- **Session Management**: Automatic redirection on authentication failures

### 5. Ownership Verification

- **Document-Level Checks**: Each document includes a `userId` field
- **API-Level Verification**: Server APIs verify document ownership
- **Rules Enforcement**: Firestore rules verify that authenticated user matches document owner

## Usage Guidelines

### API Routes

All API routes follow this pattern:

```typescript
// 1. Authenticate the request
const authResult = await authenticateRequest(request);
if (!authResult.authenticated) {
  return authResult.response;
}

// 2. Extract the authenticated user ID
const userId = authResult.userId!;

// 3. Initialize Firestore Admin
const db = await getFirestoreAdmin();

// 4. Access Firestore with proper error handling
const result = await FirestoreErrorHandler.executeOperation(
  async () => {
    const doc = await db.collection('collection').doc(id).get();
    // Verify document ownership
    if (doc.data()?.userId !== userId) throw new Error('Permission denied');
    return doc.data();
  },
  'operation',
  'resource'
);
```

### Client-Side Access

For client components:

```typescript
// Avoid direct Firestore access to sensitive collections
// Instead, use the SecureApiClient:
import { SecureApiClient } from '@/lib/secure-api-client';

// Fetch user data
const userData = await SecureApiClient.get('/api/getUserData');

// Process a file
const result = await SecureApiClient.post('/api/processPipeline', { 
  fileId, 
  purpose 
});
```

## Security Tools

### 1. FirestoreErrorHandler

Provides standardized error handling for Firestore operations with proper HTTP status codes and user-friendly messages.

### 2. SecureApiClient

Routes all authenticated API calls with proper Firebase ID token handling and error management.

### 3. SecureFirestore

Enforces the use of API endpoints for protected collections while allowing direct access to public data.

## Deployment

The Firestore security rules can be deployed using the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

## Testing

Security rules can be tested with the Firebase Rules Simulator or through unit tests using the Firebase Testing SDK.
