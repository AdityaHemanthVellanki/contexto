import { client, modelMapping } from '@/lib/azureOpenAI';
import { logUsage } from './usage';
import { auth } from '@/lib/firebase';

/**
 * Generates embeddings for text chunks using Azure OpenAI
 * 
 * @param chunks Array of text chunks to embed
 * @param userId The authenticated user ID for usage tracking
 * @returns Array of embedding vectors
 * @throws Error if the Azure OpenAI API call fails
 */
export async function runEmbedder(chunks: string[], userId: string): Promise<number[][]> {
  if (!chunks || chunks.length === 0) {
    throw new Error('No text chunks provided for embedding');
  }

  if (!userId) {
    throw new Error('User ID is required for embeddings generation');
  }

  try {
    // Call Azure OpenAI embeddings API
    const response = await client.embeddings.create({
      model: modelMapping.embed,
      input: chunks
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('Azure OpenAI returned empty embeddings data');
    }

    // Log usage with proper user ID
    await logUsage('embed', {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: 0
    }, userId);

    // Return the embedding vectors
    return response.data.map(d => d.embedding);
  } catch (error) {
    // Specific error handling with detailed messages
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('Azure OpenAI authentication failed: Invalid API key');
      } else if (error.message.includes('429')) {
        throw new Error('Azure OpenAI rate limit exceeded. Please try again later.');
      } else if (error.message.includes('500')) {
        throw new Error('Azure OpenAI service error. Please try again later.');
      }
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
    
    throw new Error(`Embedding generation failed: Unknown error`);
  }
}


