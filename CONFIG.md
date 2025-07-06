# Contexto Configuration Guide

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_EMBEDDING=your-embedding-deployment-name
AZURE_OPENAI_DEPLOYMENT_TURBO=your-gpt-35-turbo-deployment-name
AZURE_OPENAI_DEPLOYMENT_GPT4=your-gpt4-deployment-name
AZURE_OPENAI_DEPLOYMENT_OMNI=your-gpt4-32k-deployment-name

# Firebase Configuration (for auth and logging)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
FIREBASE_APP_ID=your-firebase-app-id
FIREBASE_DATABASE_URL=your-firebase-database-url

# Only required for server-side Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

## Azure OpenAI Setup

1. Create an Azure OpenAI resource in the Azure portal
2. Create the following model deployments:

| Deployment Variable | Suggested Model | Purpose |
|---------------------|-----------------|---------|
| AZURE_OPENAI_DEPLOYMENT_EMBEDDING | text-embedding-ada-002 | For generating embeddings |
| AZURE_OPENAI_DEPLOYMENT_TURBO | gpt-35-turbo | For standard completions |
| AZURE_OPENAI_DEPLOYMENT_GPT4 | gpt-4 | For high-quality refinement |
| AZURE_OPENAI_DEPLOYMENT_OMNI | gpt-4-32k | For handling large contexts |

## Firebase Setup

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication with desired providers (Google, Email/Password)
3. Create a Firestore database for storing pipelines and usage metrics
4. Generate a web app configuration and copy values to environment variables
5. For server-side functions, generate a service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file and use its contents as `FIREBASE_SERVICE_ACCOUNT`

## Firestore Collections

The application uses these Firestore collections:

- `pipelines`: Stores user pipeline configurations
- `usage_metrics`: Logs API usage statistics

## Local Development

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Access the test page
open http://localhost:3000/test
```
