// Extend NodeJS.ProcessEnv with our custom environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    // Node Environment
    NODE_ENV: 'development' | 'production' | 'test';
    
    // Deployment providers
    RENDER_TOKEN: string;
    RENDER_REGION: string;
    RENDER_PLAN: string;
    RAILWAY_TOKEN: string;
    RAILWAY_PROJECT_SLUG: string;
    HEROKU_API_KEY: string;
    HEROKU_TEAM: string;
    HEROKU_REGION: string;
    HEROKU_SOURCE_BLOB_URL: string;
    
    // AI services
    AZURE_OPENAI_API_KEY: string;
    AZURE_OPENAI_ENDPOINT: string;
    AZURE_OPENAI_DEPLOYMENT_EMBEDDING: string;
    AZURE_OPENAI_DEPLOYMENT_TURBO: string;
    
    // Vector stores
    PINECONE_API_KEY: string;
    PINECONE_ENVIRONMENT: string;
    PINECONE_INDEX_NAME: string;
    QDRANT_API_KEY: string;
    QDRANT_URL: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
    VECTOR_STORE_ENDPOINT: string;
    STORE_TYPE: string;
    
    // Additional environment variables
    CF_R2_PUBLIC_URL: string;
    CODECOV_TOKEN: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_CLIENT_EMAIL: string;
    FIREBASE_PRIVATE_KEY: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_ADMIN_CREDENTIALS: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
    GOOGLE_APPLICATION_CREDENTIALS: string;
    CF_R2_BUCKET_NAME: string;
    CLOUDFLARE_WORKER_URL: string;
    UPSTASH_REDIS_URL: string;
    UPSTASH_REDIS_TOKEN: string;
    FIREBASE_SERVICE_ACCOUNT_KEY: string;
    CF_R2_ENDPOINT: string;
    CF_R2_ACCESS_KEY_ID: string;
    CF_R2_SECRET_ACCESS_KEY: string;
    
    // Allow any other environment variables
    [key: string]: string | undefined;
  }
  
  // Extend Process to include cwd()
  interface Process {
    cwd(): string;
  }
}

// Extend global window object for client-side environment variables
declare global {
  interface Window {
    env: {
      NODE_ENV: 'development' | 'production' | 'test';
      NEXT_PUBLIC_APP_URL: string;
      R2_PUBLIC_URL: string;
      NEXT_PUBLIC_PINECONE_ENVIRONMENT?: string;
      NEXT_PUBLIC_PINECONE_INDEX?: string;
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_FIREBASE_API_KEY: string;
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
      NEXT_PUBLIC_FIREBASE_APP_ID: string;
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: string;
      [key: string]: string | undefined;
    };
  }
}

interface ImportMetaEnv {
  // Existing declarations
  NODE_ENV: 'development' | 'production';
  ADMIN_USER_ID: string;
  
  // Cloudflare R2
  CF_R2_ACCESS_KEY_ID: string;
  CF_R2_SECRET_ACCESS_KEY: string;
  CF_R2_ENDPOINT: string;
  CF_R2_BUCKET_NAME: string;
  CLOUDFLARE_WORKER_URL: string;
  
  // Heroku
  HEROKU_API_KEY: string;
  HEROKU_TEAM: string;
  HEROKU_REGION: string;
  HEROKU_SOURCE_BLOB_URL: string;
  
  // Azure OpenAI
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYMENT_EMBEDDING: string;
  AZURE_OPENAI_DEPLOYMENT_TURBO: string;
  
  // Pinecone
  PINECONE_API_KEY: string;
  PINECONE_ENVIRONMENT: string;
  PINECONE_INDEX_NAME: string;
  
  // Qdrant
  QDRANT_API_KEY: string;
  QDRANT_URL: string;
  
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  
  // Vector Stores
  VECTOR_STORE_ENDPOINT: string;
  STORE_TYPE: string;
  
  // Railway
  RAILWAY_TOKEN: string;
  RAILWAY_PROJECT_SLUG: string;
  RAILWAY_REGION: string;
}

export {};
