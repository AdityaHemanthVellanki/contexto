import { getFirestore } from 'firebase-admin/firestore';
import { client, modelMapping } from '@/lib/azureOpenAI';
import { logUsage } from './usage';

/**
 * Calculates cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0; // Handle zero vectors
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retriever node - Find most similar chunks to a query
 * 
 * @param fileId File ID to search for relevant chunks
 * @param query The query string to find similar chunks for
 * @param topK Number of top matches to return (default: 5)
 * @returns Array of most relevant text chunks
 */
export async function runRetriever(
  fileId: string,
  query: string,
  topK = 5
): Promise<string[]> {
  if (!fileId) {
    throw new Error('Retriever failed: Missing fileId parameter');
  }

  if (!query || query.trim() === '') {
    throw new Error('Retriever failed: Missing query parameter');
  }

  try {
    // Generate embedding for the query using Azure OpenAI
    if (!client) {
      throw new Error('Azure OpenAI client is not initialized');
    }

    console.log(`Generating embedding for query: "${query.substring(0, 50)}..."`);
    
    const embeddingResponse = await client.embeddings.create({
      model: modelMapping.embed,
      input: [query]
    });

    if (!embeddingResponse.data || embeddingResponse.data.length === 0) {
      throw new Error('Azure OpenAI returned empty query embedding data');
    }

    // Log usage for embedding generation
    await logUsage('embed', {
      promptTokens: embeddingResponse.usage?.prompt_tokens || 0,
      completionTokens: 0
    }, 'system');

    const queryVector = embeddingResponse.data[0].embedding;
    
    // Retrieve all embeddings for the file from Firestore
    const db = getFirestore();
    const embeddingsSnapshot = await db.collection(`uploads/${fileId}/embeddings`).get();
    
    if (embeddingsSnapshot.empty) {
      console.warn(`No embeddings found for file ${fileId}`);
      return [];
    }
    
    // Calculate similarity scores for each embedding
    const similarities: { text: string; score: number }[] = [];
    
    embeddingsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.vector && data.text) {
        const similarity = cosineSimilarity(queryVector, data.vector);
        similarities.push({
          text: data.text,
          score: similarity
        });
      }
    });
    
    // Sort by similarity score (highest first)
    similarities.sort((a, b) => b.score - a.score);
    
    // Return top K chunks
    const topChunks = similarities.slice(0, topK).map(item => item.text);
    
    console.log(`Retrieved ${topChunks.length} most relevant chunks for query`);
    
    return topChunks;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Retriever failed: ${e.message}`);
    }
    throw new Error('Retriever failed: Unknown error');
  }
}
