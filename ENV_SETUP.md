# Environment Variables Setup for Contexto

This document explains how to set up the required environment variables for Contexto.

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables.

> **Development Mode:** In development mode, the application will use placeholder values if environment variables are missing, but with limited functionality. For full functionality, please set all environment variables.

### Azure OpenAI Configuration
```
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_EMBEDDING=your-embedding-deployment-name
AZURE_OPENAI_DEPLOYMENT_TURBO=your-turbo-deployment-name
AZURE_OPENAI_DEPLOYMENT_GPT4=your-gpt4-deployment-name
AZURE_OPENAI_DEPLOYMENT_OMNI=your-omni-deployment-name
```

### Firebase Configuration
```
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### Heroku Deployment Configuration
```
HEROKU_API_KEY=your-heroku-api-key  # API key from Heroku account settings
HEROKU_TEAM=your-team-name  # Optional: Team name if deploying to a team account
HEROKU_REGION=us  # Optional: Region for deployments (defaults to 'us')
```

### Cloudflare R2 Configuration (for file storage and VSIX hosting)
```
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=your-r2-bucket-name
R2_PUBLIC_URL=your-r2-public-domain  # e.g., files.yourdomain.com
```

## Security Notes

- All Azure OpenAI environment variables are server-side only and not exposed to the client.
- Firebase configuration variables are prefixed with `NEXT_PUBLIC_` as they are required on the client side.
- The application will throw clear errors at startup if any required environment variables are missing.
- No API keys are stored in the application state or requested from users via UI.

## Development vs Production

For development:
- Use a `.env.local` file for local development.

For production:
- Set environment variables through your hosting provider's configuration interface.
- Ensure all required variables are set before deploying.
