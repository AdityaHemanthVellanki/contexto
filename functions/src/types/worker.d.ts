/// <reference types="@cloudflare/workers-types" />

declare global {
  // Extend R2Bucket interface to include getSignedUrl
  interface R2Bucket {
    getSignedUrl(
      key: string,
      options: { expiresIn: number }
    ): Promise<string>;
  }

  interface Env {
    // R2 Bucket for file storage
    UPLOADS: R2Bucket;
    
    // Azure OpenAI configuration
    AZURE_OPENAI_KEY: string;
    AZURE_OPENAI_ENDPOINT: string;
    AZURE_OPENAI_DEPLOYID: string;
    
    // Pinecone configuration
    PINECONE_API_KEY: string;
    PINECONE_ENV: string;
    
    // Environment
    NODE_ENV: 'development' | 'production';
  }
}

export {};
