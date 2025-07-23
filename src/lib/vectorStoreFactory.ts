import { v4 as uuidv4 } from 'uuid';
import { FirestoreVectorStore } from './firestoreVectorStore';
import { PineconeVectorStore } from './pineconeVectorStore';
import { QdrantVectorStore } from './qdrantVectorStore';
import { SupabaseVectorStore } from './supabaseVectorStore';
import type { VectorStore } from './vectorStoreInterface';
import { getFirestoreAdmin } from './firestore-admin';

/**
 * Factory function to create the appropriate vector store instance based on type
 * @param type The type of vector store to create
 * @param pipelineId The pipeline ID to associate with this vector store
 * @returns A VectorStore instance
 */
export async function createVectorStore(type: string, pipelineId: string): Promise<VectorStore> {
  // Normalize type to lowercase
  const normalizedType = type.toLowerCase();

  switch (normalizedType) {
    case 'firestore':
      const firestore = getFirestoreAdmin();
      return new FirestoreVectorStore(firestore, pipelineId);
    
    case 'pinecone':
      return new PineconeVectorStore(pipelineId);
    
    case 'qdrant':
      return new QdrantVectorStore(pipelineId);
    
    case 'supabase':
      return new SupabaseVectorStore(pipelineId);
    
    default:
      throw new Error(`Unsupported vector store type: ${type}. Supported types are: firestore, pinecone, qdrant, supabase`);
  }
}

/**
 * Get the appropriate vector store for a pipeline based on existing deployment
 * @param pipelineId The pipeline ID to get the vector store for
 * @returns A Promise resolving to the appropriate VectorStore instance
 */
export async function getVectorStoreForPipeline(pipelineId: string): Promise<VectorStore> {
  try {
    // Get the deployment record from Firestore
    const db = getFirestoreAdmin();
    const deploymentSnapshot = await db.collection('deployments')
      .where('pipelineId', '==', pipelineId)
      .where('type', '==', 'vectorstore')
      .limit(1)
      .get();
    
    if (deploymentSnapshot.empty) {
      throw new Error(`No vector store deployment found for pipeline ${pipelineId}`);
    }
    
    const deploymentData = deploymentSnapshot.docs[0].data();
    const storeType = deploymentData.storeType;
    
    // Create the appropriate vector store
    return createVectorStore(storeType, pipelineId);
  } catch (error) {
    console.error(`Error getting vector store for pipeline ${pipelineId}:`, error);
    throw new Error(`Failed to get vector store for pipeline ${pipelineId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the appropriate vector store based on file size and purpose
 * @param fileSizeBytes Size of the file in bytes
 * @param purpose Purpose of the vector store (e.g., 'production', 'development')
 * @returns A vector store instance
 */
export function getVectorStore(fileSizeBytes: number, purpose = 'development'): VectorStore {
  // Generate a unique pipeline ID
  const pipelineId = uuidv4();
  const firestore = getFirestoreAdmin();
  
  // Check if Pinecone is configured
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeEnvironment = process.env.PINECONE_ENVIRONMENT;
  
  // Check if Qdrant is configured
  const qdrantUrl = process.env.QDRANT_URL;
  
  // Check if Supabase is configured
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // For production use cases, prefer specialized vector stores
  if (purpose === 'production') {
    // Large files (> 10MB) - use Pinecone if available
    if (fileSizeBytes > 10 * 1024 * 1024) {
      if (pineconeApiKey && pineconeEnvironment) {
        return new PineconeVectorStore(pipelineId);
      }
      
      // No Pinecone, try Qdrant
      if (qdrantUrl) {
        return new QdrantVectorStore(pipelineId);
      }
      
      // No specialized vector stores available for large files
      throw new Error('No suitable vector store configured for large files. Please configure Pinecone or Qdrant.');
    }
    
    // Medium files (1-10MB) - use Qdrant if available
    if (fileSizeBytes > 1 * 1024 * 1024) {
      if (qdrantUrl) {
        return new QdrantVectorStore(pipelineId);
      }
      
      // Try Pinecone as fallback
      if (pineconeApiKey && pineconeEnvironment) {
        return new PineconeVectorStore(pipelineId);
      }
      
      // Try Supabase as fallback
      if (supabaseUrl && supabaseKey) {
        return new SupabaseVectorStore(pipelineId);
      }
      
      // No specialized vector stores available for medium files
      throw new Error('No suitable vector store configured for medium-sized files. Please configure Qdrant, Pinecone, or Supabase.');
    }
    
    // Small files (< 1MB) - use Supabase if available
    if (supabaseUrl && supabaseKey) {
      return new SupabaseVectorStore(pipelineId);
    }
    
    // Try Firestore for small files in production if no other options
    return new FirestoreVectorStore(firestore, pipelineId);
  }
  
  // For development, use Firestore by default
  return new FirestoreVectorStore(firestore, pipelineId);
}
