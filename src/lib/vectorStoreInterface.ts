import { z } from 'zod';

/**
 * Vector store interface for all vector store implementations
 */
export interface VectorStore {
  name: string;
  provision(): Promise<void>;
  upsert(documents: VectorDocument[]): Promise<void>;
  query(embedding: number[], topK: number, filter?: Record<string, any>): Promise<VectorQueryResult[]>;
  deleteIndex(): Promise<void>;
}

/**
 * Vector document structure for storing embeddings
 */
export interface VectorDocument {
  id: string;
  values: number[];
  metadata: {
    text: string;
    fileId: string;
    fileName: string;
    chunkIndex: number;
  };
}

/**
 * Vector query result structure
 */
export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    fileId: string;
    fileName: string;
    chunkIndex: number;
  };
}
