# Development Guide for Contexto

## Authentication and API Setup

### Local Development Setup

For local development, you can bypass strict Firebase Admin token verification by adding the following to your `.env.local` file:

```
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Local development helpers
NEXT_PUBLIC_SKIP_API_AUTH_VERIFICATION=true

# Emulator configuration (optional)
# NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=localhost
# NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST=localhost
# NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
```

The `NEXT_PUBLIC_SKIP_API_AUTH_VERIFICATION=true` setting will allow the API routes to work in development mode without a Firebase service account, which is helpful for local testing.

### Production Setup

For production, you should:

1. Remove the `NEXT_PUBLIC_SKIP_API_AUTH_VERIFICATION` flag or set it to `false`
2. Set up a service account:

```
# Firebase Admin SDK (production)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

## Troubleshooting

### Common API Errors

1. **"Failed to determine project ID"** - This occurs when Firebase Admin can't detect your project. Make sure your `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is set correctly.

2. **Authentication errors** - If you're getting 401 errors during development, check that `NEXT_PUBLIC_SKIP_API_AUTH_VERIFICATION=true` is set in your `.env.local` file.
   - The application now defaults to simplified token validation in development mode unless explicitly disabled
   - Authentication errors in the UI will show a "Sign in again" button to help users recover
   - If you're still seeing authentication errors, try clearing your browser cookies and local storage

3. **Firestore connection issues** - Verify your Firebase configuration and check that the Firestore service is enabled in your Firebase console.

4. **"Too Many Requests" errors** - The application implements rate limiting to prevent excessive API calls. If you're seeing 429 errors:
   - Client-side components have built-in retry logic with exponential backoff
   - API routes limit requests to 10 per 5 seconds for list endpoints and 5 per 10 seconds for upload/download endpoints
   - During development, you can modify these limits in the rate-limiter.ts file

## Dashboard Loading Issues

If the dashboard isn't loading properly, check:

1. Authentication redirects are working properly (should redirect to `/signin` not `/login`)
2. The loading state in the dashboard is being properly reset once data loads
3. The API routes are functioning correctly by checking the Network tab in browser DevTools

## Firestore-Only File Storage

This project uses Firestore for file storage rather than Firebase Storage. Files are stored as:

- Text files: Stored directly as string content in the Firestore document
- Binary files: Stored as Base64-encoded strings in the Firestore document

API endpoints handle the upload, retrieval and management of these files.
