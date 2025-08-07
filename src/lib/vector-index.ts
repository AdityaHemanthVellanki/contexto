import { PipelineLogger } from './utils/pipeline-logger';

export interface VectorChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    docId: string;
    docName: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
    tokenCount: number;
  };
}

export interface SimilarityResult {
  chunk: VectorChunk;
  score: number;
}

/**
 * Production-grade vector index for similarity search
 * Uses in-memory storage with cosine similarity for now
 * Can be extended to use FAISS or other vector databases
 */
export class VectorIndex {
  private chunks: Map<string, VectorChunk> = new Map();
  private logger: PipelineLogger;
  private indexName: string;

  constructor(indexName: string, logger?: PipelineLogger) {
    this.indexName = indexName;
    this.logger = logger || new PipelineLogger('VECTOR_INDEX');
  }

  /**
   * Add chunks with embeddings to the index
   */
  async addChunks(chunks: VectorChunk[]): Promise<void> {
    this.logger.stageHeader('VECTOR INDEXING');
    this.logger.info(`Adding ${chunks.length} chunks to index: ${this.indexName}`);

    const startTime = Date.now();
    
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }

    const indexingTime = Date.now() - startTime;
    
    this.logger.stageComplete('Vector indexing complete', {
      'Chunks Added': chunks.length.toString(),
      'Total Chunks': this.chunks.size.toString(),
      'Index Name': this.indexName,
      'Indexing Time': `${indexingTime}ms`
    });
  }

  /**
   * Search for similar chunks using cosine similarity
   */
  async search(queryEmbedding: number[], topK: number = 5): Promise<SimilarityResult[]> {
    this.logger.stageProgress(`Searching ${this.chunks.size} chunks for top ${topK} matches`);
    
    const startTime = Date.now();
    const results: SimilarityResult[] = [];

    // Calculate cosine similarity for each chunk
    for (const chunk of this.chunks.values()) {
      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      results.push({ chunk, score });
    }

    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);

    // Return top K results
    const topResults = results.slice(0, topK);
    const searchTime = Date.now() - startTime;

    this.logger.stageComplete('Similarity search complete', {
      'Chunks Searched': this.chunks.size.toString(),
      'Top Results': topResults.length.toString(),
      'Best Score': topResults[0]?.score.toFixed(4) || '0',
      'Search Time': `${searchTime}ms`
    });

    return topResults;
  }

  /**
   * Get chunk by ID
   */
  getChunk(chunkId: string): VectorChunk | undefined {
    return this.chunks.get(chunkId);
  }

  /**
   * Get all chunks for a document
   */
  getDocumentChunks(docId: string): VectorChunk[] {
    return Array.from(this.chunks.values()).filter(chunk => chunk.metadata.docId === docId);
  }

  /**
   * Remove all chunks for a document
   */
  removeDocument(docId: string): number {
    const chunksToRemove = Array.from(this.chunks.entries())
      .filter(([_, chunk]) => chunk.metadata.docId === docId);
    
    for (const [chunkId] of chunksToRemove) {
      this.chunks.delete(chunkId);
    }

    this.logger.info(`Removed ${chunksToRemove.length} chunks for document: ${docId}`);
    return chunksToRemove.length;
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalChunks: number;
    indexName: string;
    memoryUsage: string;
  } {
    const totalChunks = this.chunks.size;
    
    // Estimate memory usage (rough calculation)
    let memoryBytes = 0;
    for (const chunk of this.chunks.values()) {
      memoryBytes += chunk.text.length * 2; // UTF-16 characters
      memoryBytes += chunk.embedding.length * 8; // Float64 numbers
      memoryBytes += 200; // Metadata overhead
    }

    return {
      totalChunks,
      indexName: this.indexName,
      memoryUsage: `${(memoryBytes / 1024 / 1024).toFixed(2)} MB`
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Clear all chunks from the index
   */
  clear(): void {
    this.chunks.clear();
    this.logger.info(`Cleared all chunks from index: ${this.indexName}`);
  }
}

/**
 * Global vector index manager
 * Manages multiple vector indexes for different MCPs
 */
export class VectorIndexManager {
  private static instance: VectorIndexManager;
  private indexes: Map<string, VectorIndex> = new Map();
  private logger: PipelineLogger;

  private constructor() {
    this.logger = new PipelineLogger('VECTOR_MANAGER');
  }

  static getInstance(): VectorIndexManager {
    if (!VectorIndexManager.instance) {
      VectorIndexManager.instance = new VectorIndexManager();
    }
    return VectorIndexManager.instance;
  }

  /**
   * Get or create a vector index for an MCP
   */
  getIndex(mcpId: string): VectorIndex {
    if (!this.indexes.has(mcpId)) {
      const indexName = `mcp-${mcpId}`;
      this.indexes.set(mcpId, new VectorIndex(indexName, this.logger));
      this.logger.info(`Created new vector index: ${indexName}`);
    }
    return this.indexes.get(mcpId)!;
  }

  /**
   * Remove an index
   */
  removeIndex(mcpId: string): boolean {
    const removed = this.indexes.delete(mcpId);
    if (removed) {
      this.logger.info(`Removed vector index for MCP: ${mcpId}`);
    }
    return removed;
  }

  /**
   * Get all index statistics
   */
  getAllStats(): Array<{
    mcpId: string;
    stats: ReturnType<VectorIndex['getStats']>;
  }> {
    return Array.from(this.indexes.entries()).map(([mcpId, index]) => ({
      mcpId,
      stats: index.getStats()
    }));
  }
}

export default VectorIndex;
