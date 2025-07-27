/**
 * Example configuration file - copy to config.ts and fill in your values
 */

export const config = {
  // Firebase Configuration
  firebase: {
    projectId: 'your-project-id',
    clientEmail: 'your-service-account-email@project.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n',
    // Client-side Firebase config
    apiKey: 'your-firebase-api-key',
    authDomain: 'your-project-id.firebaseapp.com',
    storageBucket: 'your-project-id.appspot.com',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id'
  },

  // Cloudflare R2 Configuration (for file storage)
  r2: {
    accessKeyId: 'your-r2-access-key-id',
    secretAccessKey: 'your-r2-secret-access-key',
    bucketName: 'contexto-uploads',
    endpoint: 'https://your-account-id.r2.cloudflarestorage.com'
  },

  // Azure OpenAI Configuration
  azureOpenAI: {
    apiKey: 'your-azure-openai-api-key',
    endpoint: 'https://your-resource.openai.azure.com/',
    deployments: {
      embedding: 'text-embedding-ada-002',
      turbo: 'gpt-35-turbo',
      gpt4: 'gpt-4',
      omni: 'gpt-4o'
    }
  },

  // Vector Store Configuration
  vectorStores: {
    pinecone: {
      apiKey: 'your-pinecone-api-key',
      environment: 'us-east1-gcp',
      indexName: 'contexto-index'
    },
    qdrant: {
      apiKey: 'your-qdrant-api-key',
      url: 'https://your-cluster.qdrant.cloud'
    },
    supabase: {
      url: 'https://your-project.supabase.co',
      serviceKey: 'your-supabase-service-role-key'
    }
  },

  // Heroku Deployment Configuration
  heroku: {
    apiKey: 'your-heroku-api-key',
    team: 'your-team-name', // Optional, only if using Heroku Teams
    region: 'us' // Default region, options: us, eu, etc.
  },

  // Rate Limiting
  rateLimit: {
    requests: 10,
    windowMs: 60000
  },

  // Redis Rate Limiter (Upstash)
  redis: {
    url: 'https://your-redis-url.upstash.io',
    token: 'your-redis-token'
  },

  // Application Settings
  app: {
    nodeEnv: 'development',
    port: 3000
  }
} as const;

export type Config = typeof config;
