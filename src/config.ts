import { config as envConfig } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
envConfig();

// Define environment variable schema
const envSchema = z.object({
  // Core environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Firebase
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),
  
  // Firebase Web (client-side)
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string(),
  
  // Cloudflare R2
  CF_R2_ACCESS_KEY_ID: z.string(),
  CF_R2_SECRET_ACCESS_KEY: z.string(),
  CF_R2_BUCKET_NAME: z.string().default('contexto-uploads'),
  CF_R2_ENDPOINT: z.string().url(),
  
  // Azure OpenAI
  AZURE_OPENAI_API_KEY: z.string(),
  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_DEPLOYMENT_EMBEDDING: z.string(),
  AZURE_OPENAI_DEPLOYMENT_TURBO: z.string(),
  
  // Heroku
  HEROKU_API_KEY: z.string(),
  HEROKU_TEAM: z.string().optional(),
  HEROKU_REGION: z.enum(['us', 'eu']).default('us'),
  
  // Rate limiting
  RATE_LIMIT_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('10'),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('60000'),
  
  // Optional: Redis for rate limiting
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Optional: Vector stores
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_ENVIRONMENT: z.string().optional(),
  PINECONE_INDEX_NAME: z.string().optional(),
  
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_URL: z.string().url().optional(),
  
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
});

type EnvVars = z.infer<typeof envSchema>;

// Parse and validate environment variables
const parseEnv = (): EnvVars => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:', error.errors);
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

// Export configuration
const config = {
  // Environment
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  
  // Firebase
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    
    // Client-side config
    clientConfig: {
      apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
  },
  
  // Cloudflare R2
  r2: {
    accessKeyId: env.CF_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CF_R2_SECRET_ACCESS_KEY,
    bucketName: env.CF_R2_BUCKET_NAME,
    endpoint: env.CF_R2_ENDPOINT,
  },
  
  // Azure OpenAI
  azureOpenAI: {
    apiKey: env.AZURE_OPENAI_API_KEY,
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    deployments: {
      embedding: env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
      turbo: env.AZURE_OPENAI_DEPLOYMENT_TURBO,
    },
  },
  
  // Heroku
  heroku: {
    apiKey: env.HEROKU_API_KEY,
    team: env.HEROKU_TEAM,
    region: env.HEROKU_REGION,
  },
  
  // Rate limiting
  rateLimit: {
    requests: env.RATE_LIMIT_REQUESTS,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  },
  
  // Redis (for rate limiting)
  redis: env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  } : undefined,
  
  // Vector stores
  vectorStores: {
    pinecone: env.PINECONE_API_KEY && env.PINECONE_ENVIRONMENT && env.PINECONE_INDEX_NAME ? {
      apiKey: env.PINECONE_API_KEY,
      environment: env.PINECONE_ENVIRONMENT,
      indexName: env.PINECONE_INDEX_NAME,
    } : undefined,
    
    qdrant: env.QDRANT_API_KEY && env.QDRANT_URL ? {
      apiKey: env.QDRANT_API_KEY,
      url: env.QDRANT_URL,
    } : undefined,
    
    supabase: env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY ? {
      url: env.SUPABASE_URL,
      serviceKey: env.SUPABASE_SERVICE_KEY,
    } : undefined,
  },
} as const;

// Export the config object
export type Config = typeof config;
export default config;
