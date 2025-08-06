import * as chalk from 'chalk';
import { VectorDatabase } from '../src/lib/services/vectordb';
import { EmbeddingResult } from '../src/lib/services/embedder';

// Extended interface for test purposes
interface TestEmbeddingResult extends Omit<EmbeddingResult, 'embeddings'> {
  embeddings: Array<{
    id: string;
    vector: number[];
    text: string;
    metadata: any;
    dimensions: number;
  }>;
  dimensions?: number;
  processingTime?: number;
}

// Mock implementation of the Pinecone client for testing
class MockPineconeClient {
  private vectors: Map<string, any> = new Map();
  private namespace: string;
  
  constructor(namespace: string = 'default') {
    this.namespace = namespace;
  }
  
  async upsert(vectors: any[]): Promise<void> {
    // Store vectors in memory
    for (const vector of vectors) {
      const key = `${this.namespace}:${vector.id}`;
      this.vectors.set(key, vector);
    }
  }
  
  async query(queryVector: number[], topK: number = 5, filter?: Record<string, any>): Promise<any> {
    // Find most similar vectors using cosine similarity
    const results = Array.from(this.vectors.entries())
      .filter(([key, _]) => key.startsWith(`${this.namespace}:`))
      .map(([_, vector]) => {
        const similarity = cosineSimilarity(queryVector, vector.values);
        return {
          id: vector.id,
          score: similarity,
          metadata: vector.metadata
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    return {
      matches: results,
      namespace: this.namespace,
      queryTime: 10 // Mock query time in ms
    };
  }
  
  async deleteAll(): Promise<void> {
    // Delete all vectors in the namespace
    const keysToDelete = Array.from(this.vectors.keys())
      .filter(key => key.startsWith(`${this.namespace}:`));
    
    for (const key of keysToDelete) {
      this.vectors.delete(key);
    }
  }
}

/**
 * Test the VectorDatabase component with a mock Pinecone client
 * This test can run without external API dependencies
 */
async function testVectorDB() {
  console.log(chalk.magenta.bold('🧪 VECTOR DATABASE COMPONENT TEST - Starting'));
  
  try {
    // Create test embeddings
    const testEmbeddings: TestEmbeddingResult = {
      embeddings: [
        {
          id: 'chunk-1',
          text: "TechCorp Employee Handbook - Introduction",
          vector: generateRandomVector(1536),
          metadata: {
            docId: 'test-doc-123',
            docName: 'Sample Company Handbook',
            chunkIndex: 0,
            embeddingModel: 'text-embedding-3-small'
          },
          dimensions: 1536
        },
        {
          id: 'chunk-2',
          text: "Part-time employees who work at least 20 hours per week accrue vacation leave on a pro-rated basis.",
          vector: generateRandomVector(1536),
          metadata: {
            docId: 'test-doc-123',
            docName: 'Sample Company Handbook',
            chunkIndex: 1,
            embeddingModel: 'text-embedding-3-small'
          },
          dimensions: 1536
        },
        {
          id: 'chunk-3',
          text: "Full-time employees receive 8 sick days per year, accrued monthly.",
          vector: generateRandomVector(1536),
          metadata: {
            docId: 'test-doc-123',
            docName: 'Sample Company Handbook',
            chunkIndex: 2,
            embeddingModel: 'text-embedding-3-small'
          },
          dimensions: 1536
        }
      ],
      model: 'text-embedding-3-small',
      dimensions: 1536,
      totalEmbeddings: 3,
      processingTime: 100,
      totalTokens: 450
    };
    
    console.log(chalk.blue(`├── Created ${testEmbeddings.totalEmbeddings} test embeddings`));
    
    // Create a mock vector database
    const vectorDB = new VectorDatabase('mock-api-key', 'mock-env', 'test-index', 'test-namespace');
    
    // Replace the real Pinecone client with our mock
    (vectorDB as any).upsertEmbeddings = async (embeddingResult: EmbeddingResult, docId: string) => {
      console.log(chalk.yellow(`├── Upserting ${embeddingResult.totalEmbeddings} vectors to mock database`));
      
      const mockClient = new MockPineconeClient('test-namespace');
      
      // Prepare vectors for upsert
      const vectors = embeddingResult.embeddings.map(embedding => ({
        id: embedding.id,
        values: embedding.vector,
        metadata: {
          text: embedding.text,
          ...embedding.metadata,
          docId,
        },
      }));

      // Upsert to mock client
      await mockClient.upsert(vectors);
      
      console.log(chalk.green(`├── ✅ Upserted ${vectors.length} vectors to mock database`));
      
      // Store the mock client for later queries
      (vectorDB as any).mockClient = mockClient;
    };
    
    (vectorDB as any).queryVectors = async (queryVector: number[], topK: number = 5) => {
      console.log(chalk.yellow(`├── Querying mock database (topK: ${topK})`));
      
      const mockClient = (vectorDB as any).mockClient;
      if (!mockClient) {
        throw new Error('Mock client not initialized');
      }
      
      const startTime = Date.now();
      const queryResult = await mockClient.query(queryVector, topK);
      const queryTime = Date.now() - startTime;
      
      return {
        matches: queryResult.matches,
        queryTime,
        totalMatches: queryResult.matches.length
      };
    };
    
    // Test 1: Upsert embeddings
    console.log(chalk.yellow('\n├── Test 1: Upserting embeddings'));
    await vectorDB.upsertVectors(testEmbeddings, 'test-doc-123');
    
    // Test 2: Query vectors
    console.log(chalk.yellow('\n├── Test 2: Querying vectors'));
    
    // Create a query vector similar to chunk-2 (about part-time employees)
    const queryVector = testEmbeddings.embeddings[1].vector.map(v => v * 0.95 + Math.random() * 0.1);
    
    const queryResult = await vectorDB.queryVectors(queryVector, 2);
    
    console.log(chalk.green(`├── ✅ Query complete: ${queryResult.totalMatches} matches found`));
    console.log(chalk.blue(`├── Query time: ${queryResult.queryTime}ms`));
    
    // Verify query results
    if (queryResult.matches.length > 0) {
      console.log(chalk.blue('\n├── Top matches:'));
      queryResult.matches.forEach((match, i) => {
        console.log(chalk.blue(`├── Match ${i+1}: ${match.id} (score: ${match.score.toFixed(4)})`));
        console.log(chalk.gray(`├── Text: ${match.metadata.text.substring(0, 50)}...`));
      });
      
      // The most similar vector should be chunk-2
      const topMatchId = queryResult.matches[0].id;
      if (topMatchId === 'chunk-2') {
        console.log(chalk.green('├── ✅ Top match is correct (chunk-2)'));
      } else {
        console.log(chalk.yellow(`├── ⚠️ Expected top match to be chunk-2, got ${topMatchId}`));
      }
    } else {
      console.log(chalk.yellow('├── ⚠️ No matches found'));
    }
    
    console.log(chalk.magenta.bold('\n🎉 VECTOR DATABASE COMPONENT TEST - Complete'));
    return { success: true };
    
  } catch (error) {
    console.error(chalk.red(`❌ TEST FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`));
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(error.stack));
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Generate a random unit vector of the specified dimension
 */
function generateRandomVector(dimensions: number): number[] {
  // Generate random vector
  const vector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
  
  // Normalize to unit length
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
}

/**
 * Calculate cosine similarity between two vectors
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

// Run the test
if (require.main === module) {
  testVectorDB()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { testVectorDB };
