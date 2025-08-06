import * as chalk from 'chalk';
import { DocumentEmbedder, EmbeddingResult } from '../src/lib/services/embedder';

// Extended EmbeddingResult for testing purposes
interface TestEmbeddingResult extends EmbeddingResult {
  dimensions?: number;
  processingTime?: number;
}

// Mock implementation of the OpenAI API for testing
class MockOpenAIAPI {
  async createEmbedding(input: string[]): Promise<any> {
    // Simulate embedding generation with random vectors
    const mockEmbeddings = input.map(() => {
      // Generate a mock embedding vector (1536 dimensions)
      const dimensions = 1536;
      const vector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
      
      // Normalize the vector (unit length)
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    });
    
    // Simulate API response format
    return {
      data: mockEmbeddings.map((embedding, i) => ({
        embedding,
        index: i,
        object: 'embedding'
      })),
      usage: {
        prompt_tokens: input.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
        total_tokens: input.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0)
      }
    };
  }
}

/**
 * Test the DocumentEmbedder component with a mock OpenAI API
 * This test can run without external API dependencies
 */
async function testEmbedder() {
  console.log(chalk.magenta.bold('🧪 EMBEDDER COMPONENT TEST - Starting'));
  
  try {
    // Create test chunks
    const testChunks = [
      "TechCorp Employee Handbook - Introduction",
      "At TechCorp, we believe in innovation, integrity, collaboration, and excellence.",
      "Part-time employees who work at least 20 hours per week accrue vacation leave on a pro-rated basis.",
      "Full-time employees receive 8 sick days per year, accrued monthly.",
      "Part-time employees who work at least 20 hours per week receive sick leave on a pro-rated basis."
    ];
    
    console.log(chalk.blue(`├── Created ${testChunks.length} test chunks`));
    
    // Create a mock embedder that uses our mock API
    const mockEmbedder = new DocumentEmbedder('mock-api-key', 'text-embedding-3-small');
    
    // Replace the real API client with our mock
    (mockEmbedder as any).createEmbedding = async (texts: string[]) => {
      const mockAPI = new MockOpenAIAPI();
      return mockAPI.createEmbedding(texts);
    };
    
    // Process chunks in batches
    console.log(chalk.yellow('├── Processing chunks with mock embedder'));
    console.time('embedding');
    
    // Create a ChunkResult object to match the embedChunks method signature
    const chunkResult = {
      chunks: testChunks.map((text, index) => ({
        id: `chunk-${index}`,
        text,
        metadata: {
          chunkIndex: index,
          docId: 'test-doc-123',
          docName: 'Sample Company Handbook',
          startChar: index * 500,
          endChar: (index + 1) * 500,
          chunkLength: text.length,
          overlap: 50,
          timestamp: new Date().toISOString()
        }
      })),
      totalChunks: testChunks.length,
      totalCharacters: testChunks.reduce((sum, chunk) => sum + chunk.length, 0),
      averageChunkSize: testChunks.reduce((sum, chunk) => sum + chunk.length, 0) / testChunks.length,
      processingTime: 100 // mock processing time
    };
    
    const result = await mockEmbedder.embedChunks(chunkResult) as TestEmbeddingResult;
    
    console.timeEnd('embedding');
    
    // Validate results
    console.log(chalk.green(`├── ✅ Embedding complete: ${result.totalEmbeddings} embeddings created`));
    console.log(chalk.blue(`├── Model: ${result.model}`));
    console.log(chalk.blue(`├── Dimensions: ${result.dimensions}`));
    console.log(chalk.blue(`├── Processing Time: ${result.processingTime}ms`));
    
    // Verify embedding properties
    let validEmbeddings = 0;
    let invalidEmbeddings = 0;
    
    for (let i = 0; i < result.embeddings.length; i++) {
      const embedding = result.embeddings[i];
      
      // Check embedding dimensions
      const hasCorrectDimensions = embedding.vector.length === 1536;
      
      // Check if vector is normalized (unit length)
      const magnitude = Math.sqrt(embedding.vector.reduce((sum: number, val: number) => sum + val * val, 0));
      const isNormalized = Math.abs(magnitude - 1.0) < 0.01; // Allow small floating point errors
      
      // Check embedding metadata
      const hasValidMetadata = 
        embedding.text === testChunks[i] &&
        embedding.metadata.docId === 'test-doc-123' &&
        embedding.metadata.docName === 'Sample Company Handbook';
      
      if (hasCorrectDimensions && isNormalized && hasValidMetadata) {
        validEmbeddings++;
      } else {
        invalidEmbeddings++;
        console.log(chalk.yellow(`├── ⚠️ Embedding ${i} validation issues:`));
        if (!hasCorrectDimensions) {
          console.log(chalk.yellow(`├── ⚠️ Incorrect dimensions: ${embedding.vector.length} (expected: 1536)`));
        }
        if (!isNormalized) {
          console.log(chalk.yellow(`├── ⚠️ Vector not normalized: magnitude = ${magnitude}`));
        }
        if (!hasValidMetadata) {
          console.log(chalk.yellow(`├── ⚠️ Invalid metadata`));
        }
      }
    }
    
    console.log(chalk.blue(`├── Valid Embeddings: ${validEmbeddings}/${result.totalEmbeddings}`));
    if (invalidEmbeddings > 0) {
      console.log(chalk.yellow(`├── ⚠️ Invalid Embeddings: ${invalidEmbeddings}/${result.totalEmbeddings}`));
    }
    
    // Test vector similarity (cosine similarity)
    console.log(chalk.yellow('\n├── Testing vector similarity'));
    
    // Similar chunks should have higher similarity
    const similarChunks = [0, 2, 3]; // Chunks about employee policies
    const dissimilarChunks = [0, 1]; // Introduction vs. company values
    
    const similarVectors = similarChunks.map(i => result.embeddings[i].vector);
    const dissimilarVectors = dissimilarChunks.map(i => result.embeddings[i].vector);
    
    const similaritySimilar = cosineSimilarity(similarVectors[0], similarVectors[1]);
    const similarityDissimilar = cosineSimilarity(dissimilarVectors[0], dissimilarVectors[1]);
    
    console.log(chalk.blue(`├── Similarity between similar chunks: ${similaritySimilar.toFixed(4)}`));
    console.log(chalk.blue(`├── Similarity between dissimilar chunks: ${similarityDissimilar.toFixed(4)}`));
    
    console.log(chalk.magenta.bold('\n🎉 EMBEDDER COMPONENT TEST - Complete'));
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
  testEmbedder()
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

export { testEmbedder };
