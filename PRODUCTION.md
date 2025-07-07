# Contexto Production Deployment Guide

This guide outlines the steps required to deploy the Contexto application to production.

## Prerequisites

1. Firebase account with Firestore and Authentication enabled
2. Azure OpenAI API subscription
3. Node.js 16+ and npm installed

## Environment Configuration

Create a `.env.local` file with the following variables:

```
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Firebase Admin Configuration (for server-side)
FIREBASE_ADMIN_PROJECT_ID=your_firebase_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_ADMIN_PRIVATE_KEY=your_firebase_private_key

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint
AZURE_OPENAI_MODEL_DEPLOYMENT=your_model_deployment_name
AZURE_OPENAI_EMBED_DEPLOYMENT=your_embeddings_deployment_name
```

## Security Best Practices

1. **Firebase Authentication**: All API routes require Firebase authentication tokens in the `Authorization` header
2. **User Data Isolation**: All Firestore queries include user ID filters to ensure users can only access their own data
3. **Firestore Security Rules**: Additional security through Firestore rules that enforce user data isolation
4. **Error Handling**: Comprehensive error handling with detailed error messages for debugging
5. **Usage Tracking**: All API calls are logged with associated user IDs for auditing and monitoring

## Production Build and Deployment

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start the production server
npm start
```

## API Routes

All API routes require Firebase authentication with bearer tokens:

1. **GET /api/pipelines** - List all pipelines for the authenticated user
2. **GET /api/pipelines/[id]** - Get a specific pipeline by ID
3. **POST /api/pipelines** - Create a new pipeline
4. **DELETE /api/pipelines/[id]** - Delete a pipeline (soft delete)
5. **POST /api/pipelines/[id]/run** - Run a pipeline with the provided prompt
6. **POST /api/refine** - Refine text with AI assistance
7. **POST /api/usage** - Log usage metrics

## Important Notes

1. All Azure OpenAI API calls require proper error handling and retry mechanisms
2. Rate limiting should be implemented for production use
3. Regular monitoring of usage metrics is recommended
4. Implement proper CI/CD pipelines for automated testing and deployment
