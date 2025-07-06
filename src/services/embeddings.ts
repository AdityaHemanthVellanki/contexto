import { client, modelMapping } from '@/lib/azureOpenAI';
import { logUsage } from './usage';

/**
 * Generates embeddings for text chunks using Azure OpenAI
 * 
 * @param chunks Array of text chunks to embed
 * @returns Array of embedding vectors
 */
export async function runEmbedder(chunks: string[]): Promise<number[][]> {
  try {
    // Call Azure OpenAI embeddings API
    const response = await client.embeddings.create({
      model: modelMapping.embed as string,
      input: chunks
    });

    // Log usage
    await logUsage('embed', { 
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: 0
    });

    // Return the embedding vectors
    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`);
  }
}


