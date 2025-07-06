# Azure OpenAI Migration Guide

This document outlines the migration from standard OpenAI APIs to Azure OpenAI services in the Contexto codebase.

## Overview

All OpenAI API calls have been migrated to use Azure OpenAI endpoints exclusively. This provides:
- Enterprise-grade security and compliance
- Service Level Agreements (SLAs)
- Regional data residency 
- Private networking capabilities
- Cost management and resource governance

## Required Environment Variables

To run the application, you need to set the following environment variables:

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
FIREBASE_SERVICE_ACCOUNT={"your":"service-account-json"}
```

## Azure OpenAI Deployments

You need to create the following deployments in your Azure OpenAI resource:

1. **Embedding Model**: For text embeddings (e.g., `text-embedding-ada-002`)
2. **Turbo Model**: For chat completions (e.g., `gpt-35-turbo`)
3. **GPT-4 Model**: For higher quality refinement (e.g., `gpt-4`)
4. **Omni Model**: For handling longer contexts (e.g., `gpt-4-32k`)

## Architecture Changes

The integration modifies the following components:

1. **Azure OpenAI Client**: Centralized in `src/lib/azureOpenAI.ts` with model mappings
2. **Core Services**: 
   - `src/services/embeddings.ts`: Text embedding generation
   - `src/services/summarizer.ts`: Text summarization
   - `src/services/ragQuery.ts`: Retrieval-augmented generation
   - `src/services/refineAnswer.ts`: Answer refinement
3. **Usage Tracking**: Integration with Firebase/Firestore in `src/services/usage.ts`
4. **Pipeline Executor**: Implementation in `src/services/executePipeline.ts`
5. **API Routes**:
   - `src/pages/api/runPipeline.ts`: Execute a complete pipeline
   - `src/pages/api/refineAnswer.ts`: Refine existing responses
6. **Test Interface**: `src/components/panels/TestPanel.tsx` and `src/pages/test.tsx`

## Implementation Details

### Azure OpenAI Client Initialization

```typescript
// src/lib/azureOpenAI.ts
const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments`,
  defaultQuery: { 'api-version': '2023-12-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY }
});
```

### API Calls

All API calls now use the `model` parameter with Azure deployment names:

```typescript
const response = await client.chat.completions.create({
  model: modelMapping.turbo as string,
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7
});
```

### Usage Tracking

All API calls are tracked in Firestore:

```typescript
await logUsage('callType', {
  promptTokens: response.usage?.prompt_tokens || 0,
  completionTokens: response.usage?.completion_tokens || 0
});
```

## Testing

Visit `/test` to test the pipeline execution and refinement functionality.

## Troubleshooting

Common issues:

1. **Missing Environment Variables**: Ensure all required environment variables are set
2. **Deployment Names**: Verify Azure OpenAI deployment names match environment variables
3. **Rate Limits**: Azure OpenAI has specific rate limits based on your tier
4. **Token Limits**: Ensure input content doesn't exceed model token limits
