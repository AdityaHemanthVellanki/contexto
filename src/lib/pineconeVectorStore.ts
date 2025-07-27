import { Pinecone } from '@pinecone-database/pinecone';
import { VectorDocument, VectorQueryResult, VectorStore } from './vectorStoreInterface';

/**
 * Pinecone Vector Store implementation
 */
export class PineconeVectorStore implements VectorStore {
  name = 'pinecone';
  private indexName: string;
  private namespace: string;
  private dimensionSize: number;
  private pinecone: Pinecone;
  private index: any;

  /**
   * Create a new PineconeVectorStore
   * @param pipelineId Pipeline ID to use for namespace
   * @param dimensionSize Dimension size of embeddings (default: 1536 for OpenAI)
   */
  constructor(private pipelineId: string, dimensionSize: number = 1536) {
    const API_KEY = process.env.PINECONE_API_KEY;
    const ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;
    const INDEX_NAME = process.env.PINECONE_INDEX_NAME;

    if (!API_KEY || !ENVIRONMENT || !INDEX_NAME) {
      throw new Error(
        'Missing Pinecone config: please set PINECONE_API_KEY, PINECONE_ENVIRONMENT, and PINECONE_INDEX_NAME'
      );
    }

    this.indexName = INDEX_NAME;
    this.namespace = `pipeline-${pipelineId}`;
    this.dimensionSize = dimensionSize;
    
    // Initialize Pinecone client
    this.pinecone = new Pinecone({
      apiKey: API_KEY
    });
    
    this.index = this.pinecone.index(this.indexName);
  }

  /**
   * Provision the Pinecone vector store
   */
  async provision(): Promise<void> {
    try {
      // In a real implementation, we would check if the index exists and create it if needed
      console.log(`Provisioning Pinecone index ${this.indexName} for pipeline ${this.pipelineId}`);
      return Promise.resolve();
    } catch (error) {
      console.error('Error provisioning Pinecone vector store:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to provision Pinecone vector store: ${errorMessage}`);
    }
  }

  /**
   * Upsert documents into the Pinecone vector store
   * @param documents Array of vector documents to upsert
   */
  async upsert(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) {
      return; // Nothing to do
    }

    try {
      // Prepare vectors for Pinecone
      const vectors = documents.map(doc => ({
        id: doc.id,
        values: doc.values,
        metadata: doc.metadata
      }));

      // Upsert vectors to Pinecone
      await this.index.upsert({
        vectors,
        namespace: this.namespace
      });

      console.log(`Successfully upserted ${documents.length} documents to Pinecone`);
    } catch (error) {
      console.error('Error upserting documents to Pinecone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upsert documents to Pinecone: ${errorMessage}`);
    }
  }

  /**
   * Query the Pinecone vector store for similar documents
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
      const queryResponse = await this.index.query({
        vector: embedding,
        topK: topK,
        includeMetadata: true,
        namespace: this.namespace,
        filter: filter
      });

      return queryResponse.matches?.map((match: any) => ({
        id: match.id,
        score: match.score,
        content: match.metadata?.content || '',
        metadata: match.metadata || {}
      })) || [];
    } catch (error) {
      console.error('Error querying Pinecone vector store:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to query Pinecone vector store: ${errorMessage}`);
    }
  }

  /**
   * Delete the Pinecone vector store index
   */
  async deleteIndex(): Promise<void> {
    try {
      // In a real implementation, we would delete all vectors in the namespace
      console.log(`Deleting vectors in Pinecone index ${this.indexName} namespace ${this.namespace}`);
      return Promise.resolve();
    } catch (error) {
      console.error('Error deleting Pinecone vector store:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete Pinecone vector store: ${errorMessage}`);
    }
  }
}
