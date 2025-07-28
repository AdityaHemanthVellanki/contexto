export interface MCPParams {
  chunkSize?: number;
  chunkOverlap?: number;
  modelName?: string;
}

export interface ProcessRequest {
  userId: string;
  fileKey: string;
  mcpParams?: MCPParams;
}

export interface ProcessResponse {
  success: boolean;
  downloadUrl: string;
  key: string;
  metadata: {
    chunksCount: number;
    vectorCount: number;
    processingTimeMs: number;
  };
  error?: string;
}

export interface Embedding {
  text: string;
  embedding: number[];
  metadata: {
    chunkSize: number;
    chunkOverlap: number;
  };
}

export interface UploadResponse {
  success: boolean;
  key: string;
  url: string;
  name: string;
  size: number;
  type: string;
  error?: string;
}
