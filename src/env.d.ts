declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Node Environment
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      
      // Firebase Admin (Required)
      FIREBASE_PROJECT_ID?: string;
      FIREBASE_CLIENT_EMAIL?: string;
      FIREBASE_PRIVATE_KEY?: string;
      FIREBASE_STORAGE_BUCKET?: string;
      
      // Firebase Admin (Optional)
      FIREBASE_ADMIN_CREDENTIALS?: string;
      FIREBASE_SERVICE_ACCOUNT_KEY?: string;
      
      // Firebase Client
      NEXT_PUBLIC_FIREBASE_API_KEY?: string;
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
      NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
      NEXT_PUBLIC_FIREBASE_APP_ID?: string;
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
      NEXT_PUBLIC_FIREBASE_DATABASE_URL?: string;
      
      // Firebase Emulators
      FIREBASE_AUTH_EMULATOR_HOST?: string;
      FIRESTORE_EMULATOR_HOST?: string;
      FIREBASE_STORAGE_EMULATOR_HOST?: string;
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?: string;
      NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST?: string;
      NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT?: string;
      NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST?: string;
      NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT?: string;
      
      // Cloudflare R2
      CF_R2_ACCESS_KEY_ID: string;
      CF_R2_SECRET_ACCESS_KEY: string;
      CF_R2_ENDPOINT: string;
      CF_R2_BUCKET_NAME: string;
      CF_R2_ACCOUNT_ID: string;
      CF_R2_PUBLIC_URL: string;
      
      // Build/Deployment
      CI?: 'true' | 'false';
      VERCEL?: '1';
      
      // CI/CD Environment Variables
      CODECOV_TOKEN?: string;
      HEROKU_API_KEY?: string;
      HEROKU_TEAM?: string;
      HEROKU_REGION?: string;
      
      // Vector Stores
      PINECONE_API_KEY?: string;
      PINECONE_ENVIRONMENT?: string;
      PINECONE_INDEX?: string;
      PINECONE_INDEX_NAME?: string;
      QDRANT_API_KEY?: string;
      SUPABASE_URL?: string;
      SUPABASE_SERVICE_KEY?: string;
      
      // NextAuth
      NEXTAUTH_URL?: string;
      NEXTAUTH_SECRET: string;
      
      // OpenAI
      OPENAI_API_KEY?: string;
      
      // Azure OpenAI
      AZURE_OPENAI_API_KEY?: string;
      AZURE_OPENAI_API_INSTANCE_NAME?: string;
      AZURE_OPENAI_API_DEPLOYMENT_NAME?: string;
      AZURE_OPENAI_API_VERSION?: string;
      AZURE_OPENAI_ENDPOINT?: string;
      AZURE_OPENAI_DEPLOYMENT_EMBEDDING?: string;
      AZURE_OPENAI_DEPLOYMENT_TURBO?: string;
      AZURE_OPENAI_DEPLOYMENT_GPT4?: string;
      AZURE_OPENAI_DEPLOYMENT_OMNI?: string;
      
      // Application
      NEXT_PUBLIC_APP_URL?: string;
      R2_PUBLIC_URL?: string;
      
      // Logging
      LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
      DEBUG?: string;
      
      // Upstash Redis
      UPSTASH_REDIS_REST_URL?: string;
      UPSTASH_REDIS_REST_TOKEN?: string;
      
      // Node.js Process
      cwd?: () => string;
    }
  }
}

export {};
