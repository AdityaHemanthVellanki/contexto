// Environment variables available in the Cloudflare Worker
export interface Env {
  // R2 Bucket bindings
  UPLOADS: R2Bucket;
  
  // Azure OpenAI Configuration
  AZURE_OPENAI_KEY: string;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYID: string;
  
  // Pinecone Configuration
  PINECONE_API_KEY: string;
  PINECONE_ENV: string;
  
  // Optional: Add any additional environment variables here
  // For example:
  // NODE_ENV: 'development' | 'production';
  // DEBUG?: string;
}

// Type for MCP processing parameters
export interface MCPParams {
  modelName?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  // Add any additional MCP-specific parameters here
}

// Type for file metadata
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  userId: string;
  // Add any additional metadata fields here
}

// Type for the processing response
export interface ProcessResponse {
  success: boolean;
  downloadUrl: string;
  key: string;
  metadata: {
    chunksCount: number;
    vectorCount: number;
    processingTimeMs: number;
    // Add any additional metadata fields here
  };
  error?: string;
}
