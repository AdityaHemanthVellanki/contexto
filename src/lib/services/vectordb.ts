import chalk from 'chalk';
import { EmbeddingResult } from './embedder';
import { 
  ensureIndex, 
  upsertEmbeddings, 
  queryEmbeddings,
  deleteEmbeddings 
} from '../pinecone-client';

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    chunkIndex: number;
    docId: string;
    docName: string;
    timestamp: string;
    embeddingModel: string;
    embeddedAt: string;
    [key: string]: any;
  };
}

export interface QueryResult {
  matches: Array<{
    id: string;
    score: number;
    metadata: VectorRecord['metadata'];
  }>;
  queryTime: number;
  totalMatches: number;
}

export class VectorDatabase {
  private indexName: string;
  private namespace?: string;

  constructor(apiKey: string, environment: string, indexName: string, namespace?: string) {
    if (!apiKey) {
      console.error(chalk.red('├── ❌ Pinecone API key is missing!'));
      throw new Error('Pinecone API key is required for vector database service');
    }
    
    this.indexName = indexName;
    this.namespace = namespace;

    console.log(chalk.cyan(`├── 🗃️  Vector DB initialized (index: ${indexName}${namespace ? `, namespace: ${namespace}` : ''})`));
  }

  async ensureIndexExists(dimensions: number): Promise<void> {
    try {
      console.log(chalk.yellow(`├── 🔍 Ensuring index "${this.indexName}" exists with ${dimensions} dimensions`));
      
      await ensureIndex(this.indexName);
      
      console.log(chalk.green(`├── ✅ Index "${this.indexName}" is ready`));
    } catch (error) {
      console.error(chalk.red(`├── ❌ Index setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      // Don't throw error if index already exists
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(chalk.green(`├── ✅ Index "${this.indexName}" already exists`));
        return;
      }
      console.log(chalk.yellow(`├── ⚠️  Proceeding with existing index configuration`));
    }
  }

  async upsertVectors(embeddingResult: EmbeddingResult, docId: string): Promise<void> {
    console.log(chalk.yellow(`├── 💾 Upserting ${embeddingResult.totalEmbeddings} vectors to index "${this.indexName}"`));
    
    try {
      const startTime = Date.now();
      
      // Prepare vectors for upsert using the existing Pinecone client format
      const vectors = embeddingResult.embeddings.map(embedding => ({
        id: embedding.id,
        values: embedding.vector,
        metadata: {
          text: embedding.text,
          ...embedding.metadata,
          docId,
        },
      }));

      // Use the existing working Pinecone client
      await upsertEmbeddings(this.indexName, vectors, this.namespace || '');

      const processingTime = Date.now() - startTime;
      console.log(chalk.green(`├── ✅ Upsert complete in ${processingTime}ms`));
      console.log(chalk.green(`├── [DB] Inserted ${vectors.length} vectors for doc "${docId}"`));

    } catch (error) {
      console.error(chalk.red(`├── ❌ Vector upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Vector upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async queryVectors(queryVector: number[], topK: number = 5, filter?: Record<string, any>): Promise<QueryResult> {
    console.log(chalk.yellow(`├── 🔍 Querying vector database (topK: ${topK})`));
    
    try {
      const startTime = Date.now();
      
      // Use the existing working Pinecone client
      const matches = await queryEmbeddings(
        this.indexName,
        queryVector,
        topK,
        this.namespace || '',
        true
      );
        
      const queryTime = Date.now() - startTime;

      console.log(chalk.green(`├── ✅ Query complete in ${queryTime}ms`));
      console.log(chalk.blue(`├── [Retrieval] Top ${matches.length} matches retrieved from index "${this.indexName}"`));

      // Log match details
      matches.forEach((match, index) => {
        console.log(chalk.gray(`├── [Match ${index + 1}] Score: ${match.score?.toFixed(4)}, ID: ${match.id}`));
      });

      return {
        matches: matches.map(match => ({
          id: match.id || '',
          score: match.score || 0,
          metadata: match.metadata as VectorRecord['metadata'],
        })),
        queryTime,
        totalMatches: matches.length,
      };

    } catch (error) {
      console.error(chalk.red(`├── ❌ Vector query failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Vector query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteVectors(docId: string): Promise<void> {
    console.log(chalk.yellow(`├── 🗑️  Deleting vectors for document: ${docId}`));
    
    try {
      await deleteEmbeddings(docId, this.indexName, this.namespace);
      console.log(chalk.green(`├── ✅ Vectors deleted successfully`));
    } catch (error) {
      console.error(chalk.red(`├── ❌ Error deleting vectors: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw error;
    }
  }
  
  /**
   * Returns the current index name
   */
  getIndexName(): string {
    return this.indexName;
  }

  async getIndexStats(): Promise<any> {
    try {
      // For now, return basic stats since the existing client doesn't expose describeIndexStats
      const stats = {
        indexName: this.indexName,
        namespace: this.namespace,
        ready: true
      };
      
      console.log(chalk.blue(`├── 📊 Index stats: ${JSON.stringify(stats, null, 2)}`));
      return stats;
    } catch (error) {
      console.error(chalk.red(`├── ❌ Failed to get index stats: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw error;
    }
  }
}

export const createVectorDB = (apiKey: string, environment: string, indexName: string, namespace?: string) => {
  return new VectorDatabase(apiKey, environment, indexName, namespace);
};
