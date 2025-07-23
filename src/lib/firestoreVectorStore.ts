import type { Firestore } from 'firebase-admin/firestore';
import { VectorDocument, VectorQueryResult, VectorStore } from './vectorStoreInterface';

/**
 * Firestore Vector Store - production-ready implementation
 * Stores and queries embeddings in Firestore collections
 */
export class FirestoreVectorStore implements VectorStore {
  name = 'firestore';
  private collection: FirebaseFirestore.CollectionReference;
  private dimensionSize: number;
  private readonly maxVectorsToScan = 1000; // Limit for production safety

  /**
   * Create a new FirestoreVectorStore
   * @param firestore Firestore instance
   * @param pipelineId Pipeline ID to use for collection namespacing
   * @param dimensionSize Dimension size of embeddings (default: 1536 for OpenAI)
   */
  constructor(
    private firestore: Firestore, 
    private pipelineId: string, 
    dimensionSize: number = 1536
  ) {
    this.collection = firestore.collection(`embeddings/${pipelineId}/chunks`);
    this.dimensionSize = dimensionSize;
  }
  
  /**
   * Provision the vector store - no-op for Firestore as collections are created on demand
   */
  async provision(): Promise<void> {
    // No-op for Firestore; collections are created automatically when documents are added
    console.log(`Firestore vector store ready for pipeline ${this.pipelineId}`);
    
    // Create a metadata document to mark this collection as provisioned
    await this.firestore.collection('embeddings').doc(this.pipelineId).set({
      createdAt: new Date(),
      status: 'provisioned',
      type: 'firestore',
      dimension: this.dimensionSize
    }, { merge: true });
    
    return Promise.resolve();
  }

  /**
   * Upsert documents into the vector store
   * @param documents Array of vector documents to upsert
   */
  async upsert(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) {
      return; // Nothing to do
    }

    try {
      // Use batched writes for efficiency
      const batches = [];
      const batchSize = 500; // Firestore batch limit is 500
      
      // Split documents into batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = this.firestore.batch();
        const batchDocuments = documents.slice(i, i + batchSize);
        
        batchDocuments.forEach(doc => {
          // Validate embedding dimensions
          if (doc.values.length !== this.dimensionSize) {
            throw new Error(`Embedding dimension mismatch: expected ${this.dimensionSize}, got ${doc.values.length}`);
          }
          
          const docRef = this.collection.doc(doc.id);
          batch.set(docRef, {
            id: doc.id,
            values: doc.values, // Store as 'values' for consistency with other vector stores
            metadata: doc.metadata,
            createdAt: new Date(),
            // Add fields to help with filtering
            fileId: doc.metadata.fileId,
            fileName: doc.metadata.fileName,
            chunkIndex: doc.metadata.chunkIndex
          });
        });
        
        batches.push(batch.commit());
      }
      
      // Execute all batches in parallel
      await Promise.all(batches);
      console.log(`Upserted ${documents.length} documents to Firestore vector store for pipeline ${this.pipelineId}`);
    } catch (error) {
      console.error('Firestore vector store upsert error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upsert to Firestore vector store: ${errorMessage}`);
    }
  }

  /**
   * Query the vector store for similar documents
   * @param embedding Query embedding vector
   * @param topK Number of results to return
   * @param filter Optional filter criteria
   * @returns Array of query results sorted by similarity
   */
  async query(embedding: number[], topK: number, filter?: Record<string, any>): Promise<VectorQueryResult[]> {
    if (embedding.length !== this.dimensionSize) {
      throw new Error(`Query embedding dimension mismatch: expected ${this.dimensionSize}, got ${embedding.length}`);
    }

    try {
      // Build query
      let baseQuery = this.collection.limit(this.maxVectorsToScan);
      
      // Apply filters if provided
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined) {
            baseQuery = baseQuery.where(key, '==', value);
          }
        });
      }
      
      // Get vectors with pagination for safety
      const vectorsSnapshot = await baseQuery.get();
      
      if (vectorsSnapshot.empty) {
        console.warn(`No vectors found in Firestore for pipeline ${this.pipelineId}`);
        return [];
      }
      
      // Fetch all documents and compute similarity in memory
      const texts: { id: string; values: number[]; metadata: any }[] = [];
      
      vectorsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        
        // Skip documents with missing or invalid embeddings
        if (!data.values || !Array.isArray(data.values) || data.values.length !== this.dimensionSize) {
          console.warn(`Skipping document ${doc.id} due to invalid embedding`);
          return;
        }
        
        texts.push({
          id: doc.id,
          values: data.values,
          metadata: data.metadata
        });
      });
      
      // Compute similarity using dot product and vector norms
      const dot = (a: number[], b: number[]): number => {
        return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
      };
      
      const norm = (a: number[]): number => {
        return Math.sqrt(dot(a, a));
      };
      
      const qNorm = norm(embedding);
      
      const scored = texts.map(({ id, values, metadata }) => ({
        id,
        metadata,
        score: dot(values, embedding) / (norm(values) * qNorm)
      }));
      
      // Sort by similarity score and return top K
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    } catch (error) {
      console.error('Firestore vector store query error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to query Firestore vector store: ${errorMessage}`);
    }
  }
  
  /**
   * Delete the vector store index
   */
  async deleteIndex(): Promise<void> {
    try {
      // Delete all documents in batches
      const snapshot = await this.collection.listDocuments();
      
      if (snapshot.length === 0) {
        return; // Nothing to delete
      }
      
      const batchSize = 500; // Firestore batch limit
      
      // Delete in batches
      for (let i = 0; i < snapshot.length; i += batchSize) {
        const batch = this.firestore.batch();
        const batchDocs = snapshot.slice(i, i + batchSize);
        
        batchDocs.forEach(docRef => batch.delete(docRef));
        await batch.commit();
      }
      
      // Delete the metadata document
      await this.firestore.collection('embeddings').doc(this.pipelineId).delete();
      
      console.log(`Deleted vector store for pipeline ${this.pipelineId}`);
    } catch (error) {
      console.error('Error deleting Firestore vector store:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete Firestore vector store: ${errorMessage}`);
    }
  }
}
