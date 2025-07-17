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
AZURE_OPENAI_ENDPOINT=https://openai-buildai.openai.azure.com

# Use the exact deployment names from your Azure OpenAI Studio
# Ensure the names match exactly - note the hyphens in deployment names
AZURE_OPENAI_DEPLOYMENT_EMBEDDING=text-embedding-ada-002
AZURE_OPENAI_DEPLOYMENT_TURBO=gpt-35-turbo
AZURE_OPENAI_DEPLOYMENT_GPT4=gpt-4
AZURE_OPENAI_DEPLOYMENT_OMNI=gpt-4o

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

The following deployments are available in your Azure OpenAI resource:

1. **`gpt-35-turbo`**: Standard chat model for most queries (note the hyphen format)
2. **`gpt-4`**: Higher quality model for complex tasks
3. **`gpt-4o`**: Latest GPT-4 Omni model 
4. **`text-embedding-ada-002`**: Embedding model for vector search

These specific deployment names must be used when configuring environment variables.

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

Common issues and solutions:

1. **404 Errors**: The most common issue is when deployment names don't match exactly with what's in your Azure OpenAI Studio
   - Solution: Use the exact names shown in the Azure Portal: `gpt-35-turbo`, `gpt-4`, `gpt-4o`, and `text-embedding-ada-002`
   - Note that hyphens matter (`gpt-35-turbo` vs `gpt35-turbo`)

2. **API Version Errors**: Azure OpenAI requires specific API versions
   - Solution: All API calls include the `api-version=2023-12-01-preview` parameter

3. **Embedding Failures**: If embeddings fail, the application uses a fallback search
   - The fallback provides simulated results that allow the application to continue functioning
   - Check Azure OpenAI Studio for any deployment issues or rate limits

4. **Chat Completion Errors**: The app tries multiple deployment names in sequence
   - If all fail, it provides a basic response based on available context
   - Check Azure OpenAI logs for specific error messages

5. **Firebase Integration**: This application uses Firebase for authentication and storage after the Supabase migration
   - Ensure Firebase environment variables are correctly configured
