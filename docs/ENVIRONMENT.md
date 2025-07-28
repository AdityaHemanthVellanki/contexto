# Environment Variables

This document outlines all the required environment variables for the Contexto application.

## Server-Side Variables

These variables are only used on the server and are not exposed to the browser.

### Azure OpenAI
```
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
AZURE_OPENAI_DEPLOYMENT_EMBEDDING=your-embedding-deployment
AZURE_OPENAI_DEPLOYMENT_TURBO=your-turbo-deployment
AZURE_OPENAI_DEPLOYMENT_GPT4=your-gpt4-deployment
AZURE_OPENAI_DEPLOYMENT_OMNI=your-omni-deployment
```

### Vector Stores
```
PINECONE_API_KEY=your-pinecone-api-key
QDRANT_API_KEY=your-qdrant-api-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### Cloudflare R2
```
CF_R2_ACCESS_KEY_ID=your-r2-access-key-id
CF_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
CF_R2_BUCKET_NAME=your-r2-bucket-name
CF_R2_ENDPOINT=your-r2-endpoint
```

### Heroku (for deployments)
```
HEROKU_API_KEY=your-heroku-api-key
HEROKU_TEAM=your-heroku-team
HEROKU_REGION=your-heroku-region
```

### Other
```
ADMIN_USER_ID=your-admin-user-id
```

## Client-Side Variables

These variables are exposed to the browser and must be prefixed with `NEXT_PUBLIC_`.

```
NEXT_PUBLIC_APP_URL=your-app-url
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_PINECONE_ENVIRONMENT=your-pinecone-environment
NEXT_PUBLIC_PINECONE_INDEX=your-pinecone-index
NEXT_PUBLIC_R2_PUBLIC_URL=your-r2-public-url
```

## Setting Up Environment Variables

1. Create a `.env.local` file in the project root
2. Copy the variables above into the file
3. Replace the placeholder values with your actual configuration
4. Never commit `.env.local` to version control

## Type Safety

All environment variables are typed in `src/lib/env.ts`. Use the provided utility functions to access them in a type-safe way:

```typescript
// Server-side only
import { getServerEnv } from '@/lib/env';
const { AZURE_OPENAI_API_KEY } = getServerEnv();

// Client-side or server-side
import { getPublicEnv } from '@/lib/env';
const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
```
