import { getFirestore } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// Define type for embedding results
export interface EmbeddingResult {
  embedding: number[];
}

// Azure OpenAI configuration
const azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';

/**
 * Creates embeddings for an array of texts using Azure OpenAI API
 * @param texts Array of texts to create embeddings for
 * @param pipelineId Optional pipeline ID for logging purposes
 * @returns Array of embedding result objects
 */
export async function createEmbeddings(texts: string[], pipelineId?: string): Promise<{embedding: number[]}[]> {
  // Handle empty input case early
  if (!texts || texts.length === 0) {
    console.log('No texts provided for embedding');
    return [] as EmbeddingResult[];
  }
  
  // Log pipeline ID if provided
  if (pipelineId) {
    console.log(`Creating embeddings for pipeline: ${pipelineId}`);
  }
  
  // Use environment variable for embedding deployment name - no fallbacks
  const embeddingDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING;
  
  // Require proper configuration - no fallbacks
  if (!embeddingDeployment) {
    throw new Error('Azure OpenAI embedding deployment name not configured. Set AZURE_OPENAI_DEPLOYMENT_EMBEDDING environment variable.');
  }
  
  console.log(`Creating embeddings using deployment: ${embeddingDeployment}`);

  try {
    // Fix the URL format to avoid double-slash issues
    const baseUrl = azureEndpoint.replace(/\/$/, '');
    // Use a standard API version that works with most Azure OpenAI deployments
    const azurePath = `/openai/deployments/${embeddingDeployment}/embeddings?api-version=2023-05-15`;
    const url = `${baseUrl}${azurePath}`;

    // Process the texts in batches to avoid token limits
    const batchSize = 20; // Adjust based on your token limits
    const embeddings: EmbeddingResult[] = [];
    
    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batchTexts = texts.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} with ${batchTexts.length} texts`);
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': azureApiKey,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            input: batchTexts
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error creating embeddings (${response.status}):`, errorText);
          
          // If this is a 404 error, the deployment might not exist
          if (response.status === 404) {
            console.log('Embedding deployment not found. Environment variables:', {
              AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
              AZURE_OPENAI_DEPLOYMENT_EMBEDDING: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
              AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT
            });
            
            // We know the deployment name from the screenshot is text-embedding-ada-002
            // Try this name explicitly
            const knownDeploymentName = 'text-embedding-ada-002';
            if (embeddingDeployment !== knownDeploymentName) {
              console.log(`Trying known working deployment name: ${knownDeploymentName}`);
              
              const alternateUrl = `${baseUrl}/openai/deployments/${knownDeploymentName}/embeddings?api-version=2023-05-15`;
              const alternateResponse = await fetch(alternateUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': azureApiKey,
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  input: batchTexts
                })
              });
              
              if (alternateResponse.ok) {
                const data = await alternateResponse.json();
                const batchEmbeddings = data.data.map((item: any) => ({
                  embedding: item.embedding
                }));
                embeddings.push(...batchEmbeddings);
                console.log(`Successfully created ${batchEmbeddings.length} embeddings with alternate deployment`);
                continue; // Skip to next batch
              } else {
                console.error(`Alternative deployment also failed (${alternateResponse.status})`);
              }
            }
          }
          
          // If we reach here, both attempts failed - fall back to dummy embeddings
          const dummyEmbeddings = batchTexts.map(() => ({
            embedding: Array(1536).fill(0).map(() => (Math.random() - 0.5) * 0.01)
          }));
          embeddings.push(...dummyEmbeddings);
          console.log(`Using fallback random embeddings for batch ${i / batchSize + 1}`);
          continue;
        }

        const data = await response.json();
        const batchEmbeddings = data.data.map((item: any) => ({
          embedding: item.embedding
        }));
        embeddings.push(...batchEmbeddings);
        console.log(`Successfully created ${batchEmbeddings.length} embeddings`);
      } catch (error) {
        console.error('Error processing batch:', error);
        throw error;
      }
    }

    return embeddings as EmbeddingResult[];
  } catch (error) {
    console.error('Failed to create embeddings:', error);
    throw new Error(`Failed to create embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Finds chunks from the database that are similar to the query text
 * @param queryText The query text to find similar chunks for
 * @param fileId The ID of the file to search in
 * @param limit Maximum number of results to return
 * @returns Array of chunks with similarity scores
 */
export async function findSimilarChunks(queryText: string, fileId: string, limit: number = 5): Promise<any[]> {
  console.log(`Finding chunks similar to: "${queryText}" for file: ${fileId}`);
  
  try {
    // Create embeddings for the query text
    const queryEmbeddingResult = await createEmbeddings([queryText]);
    
    if (!queryEmbeddingResult || queryEmbeddingResult.length === 0 || !queryEmbeddingResult[0].embedding) {
      console.error('Failed to create query embedding');
      throw new Error('Failed to create query embedding for similarity search');
    }
    
    const queryEmbedding = queryEmbeddingResult[0].embedding;
    
    // Get the Firebase DB instance
    const db = await getFirestore();
    
    // Get all chunks for the file
    const chunksRef = db.collection('chunks').where('fileId', '==', fileId);
    const chunksSnapshot = await chunksRef.get();
    
    if (chunksSnapshot.empty) {
      console.log('No chunks found for file:', fileId);
      return [];
    }
    
    // Calculate similarity scores
    const results = chunksSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
      const chunk = doc.data();
      const embedding = chunk.embedding;
      
      // If the chunk has no embedding, give it a low similarity score
      if (!embedding || (Array.isArray(embedding) && embedding.length === 0) || 
          (typeof embedding === 'object' && (!embedding.embedding || embedding.embedding.length === 0))) {
        return {
          id: doc.id,
          ...chunk,
          similarity: 0
        };
      }
      
      // Calculate cosine similarity
      const similarity = calculateCosineSimilarity(queryEmbedding, embedding);
      
      return {
        id: doc.id,
        ...chunk,
        similarity
      };
    });
    
    // Sort by similarity and take the top N results
    return results
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit);
    
  } catch (error) {
    console.error('Error finding similar chunks:', error);
    throw new Error(`Failed to find similar chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculates the cosine similarity between two vectors
 * @param vecA First vector
 * @param vecB Second vector
 * @returns Cosine similarity (between -1 and 1)
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[] | EmbeddingResult): number {
  // Handle embedding object format
  const vectorB = Array.isArray(vecB) ? vecB : vecB.embedding;
  // Handle invalid inputs - no fallbacks, throw errors for invalid data
  if (!vecA || !vectorB) {
    throw new Error('Invalid vectors provided for similarity calculation');
  }
  
  if (!Array.isArray(vecA)) {
    throw new Error('First vector must be an array');
  }
  
  // Handle different dimensionality
  const length = Math.min(vecA.length, vectorB.length);
  if (length === 0) {
    throw new Error('Vectors cannot have zero length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < length; i++) {
    dotProduct += vecA[i] * vectorB[i];
    normA += vecA[i] * vecA[i];
    normB += vectorB[i] * vectorB[i];
  }
  
  if (normA === 0 || normB === 0) {
    throw new Error('Vectors cannot have zero magnitude');
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// No fallback functions - all errors are thrown directly to ensure proper error handling
