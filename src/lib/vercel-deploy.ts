/**
 * Helper functions for Vercel deployments
 */
import { VercelFile } from '../types/deployment';
import OpenAI from 'openai';

/**
 * Get vector store API key based on store type
 */
export function getVectorStoreApiKey(storeType: string): string | undefined {
  switch (storeType) {
    case 'pinecone':
      return process.env.PINECONE_API_KEY;
    case 'qdrant':
      return process.env.QDRANT_API_KEY;
    case 'supabase':
      return process.env.SUPABASE_SERVICE_KEY;
    default:
      return undefined;
  }
}

/**
 * Get store-specific configuration based on store type
 */
export function getStoreSpecificConfig(
  storeType: string, 
  pipelineId: string, 
  userId: string
): Record<string, unknown> {
  switch (storeType) {
    case 'pinecone':
      return {
        namespace: `${userId}-${pipelineId}`
      };
    case 'qdrant':
      return {
        collectionName: `contexto-${pipelineId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      };
    case 'supabase':
      return {
        tableName: `contexto_${pipelineId}`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      };
    case 'firestore':
      return {
        collectionPath: `contexto-vectors/${userId}/${pipelineId}`
      };
    default:
      return {};
  }
}

/**
 * Set environment variables for a Vercel deployment
 */
export async function setVercelEnvironmentVariables(
  deploymentId: string,
  envVars: Record<string, string>
): Promise<void> {
  if (!process.env.VERCEL_AUTH_TOKEN) {
    console.error('Vercel auth token not configured, skipping env var setup');
    return;
  }

  try {
    const variables = Object.entries(envVars).map(([key, value]) => ({
      key,
      value,
      target: ['production', 'preview']
    }));

    const response = await fetch(
      `https://api.vercel.com/v9/projects/${deploymentId}/env`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ envs: variables })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to set Vercel environment variables:', error);
    }

    console.log('Set Vercel environment variables for deployment');
  } catch (error) {
    console.error('Error setting Vercel environment variables:', error);
  }
}

/**
 * Generate embedding using Azure OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const embeddingDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002';
  
  if (!azureApiKey || !azureEndpoint) {
    throw new Error('Azure OpenAI credentials not configured');
  }
  
  try {
    const openai = new OpenAI({
      apiKey: azureApiKey,
      baseURL: `${azureEndpoint}/openai/deployments/${embeddingDeployment}`,
      defaultQuery: { 'api-version': '2023-05-15' },
      defaultHeaders: { 'api-key': azureApiKey }
    });
    
    const response = await openai.embeddings.create({
      model: embeddingDeployment,
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
