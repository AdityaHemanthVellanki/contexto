import { client, modelMapping } from '@/lib/azureOpenAI';
import { logUsage } from './usage';

/**
 * Embedder node - Creates embeddings for text chunks using Azure OpenAI
 * Simplified implementation that only uses Azure OpenAI (no fallbacks)
 * 
 * @param chunks Array of text chunks to embed
 * @returns Array of embedding vectors
 * @throws Error if the embedding generation fails
 */
export async function runEmbedder(chunks: string[]): Promise<number[][]> {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    console.warn('Embeddings cannot be generated in browser environment');
    throw new Error('Embeddings can only be generated on the server');
  }

  if (!chunks || chunks.length === 0) {
    throw new Error('No text chunks provided for embedding');
  }

  try {
    // Handle chunking for large inputs by batching if needed
    const BATCH_SIZE = 20; // Adjust based on your Azure OpenAI instance limits
    let allEmbeddings: number[][] = [];
    
    // Process in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      console.log(`Processing embedding batch ${i/BATCH_SIZE + 1} of ${Math.ceil(chunks.length/BATCH_SIZE)}`);
      
      if (!client) {
        throw new Error('Azure OpenAI client is not initialized');
      }
      
      // Get the deployment name from environment variables or use a default
      const embeddingModel = process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002';
      
      console.log(`Creating embeddings with Azure OpenAI deployment: ${embeddingModel}`);
      
      // Use Azure OpenAI client with the explicit deployment name
      // This bypasses any issues with modelMapping
      const response = await client.embeddings.create({
        model: embeddingModel,
        input: batchChunks
      });
      
      if (!response.data || response.data.length === 0) {
        throw new Error('Azure OpenAI returned empty embeddings data');
      }

      // Log usage for this batch with a dummy user ID since we're tracking pipeline usage
      await logUsage('embed', {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: 0
      }, 'system');

      // Add batch embeddings to result
      const batchEmbeddings = response.data.map(d => d.embedding);
      allEmbeddings = [...allEmbeddings, ...batchEmbeddings];
    }

    return allEmbeddings;
  } catch (error) {
    // Enhanced error handling with more details
    let errorMessage = 'Unknown error';
    let statusCode = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check if this is an API error with status code
      if ('status' in error && typeof (error as any).status === 'number') {
        statusCode = String((error as any).status);
      }
    }
    
    // Provide specific guidance based on error type
    if (statusCode === '404') {
      console.error(`Azure OpenAI API returned 404 Not Found. This likely means the deployment name '${process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002'}' doesn't exist in your Azure OpenAI service.`);
      console.error('Please check your Azure OpenAI deployments and ensure the AZURE_OPENAI_DEPLOYMENT_EMBEDDING environment variable matches an existing deployment name.');
      throw new Error(`Embedder failed: The specified Azure OpenAI deployment was not found (404). Please check your environment variables and Azure OpenAI configuration.`);
    } else if (statusCode === '401' || statusCode === '403') {
      console.error('Azure OpenAI API authentication failed. Please check your API key and permissions.');
      throw new Error(`Embedder failed: Authentication error with Azure OpenAI API (${statusCode}). Please check your API key.`);
    } else {
      console.error('Azure OpenAI API error:', error);
      throw new Error(`Embedder failed with Azure OpenAI: ${errorMessage}`);
    }
  }
}
