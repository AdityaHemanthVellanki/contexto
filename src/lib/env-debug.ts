// Simple utility to debug environment variable loading

export function debugEnvironment() {
  const envVars = {
    // Firebase Admin SDK
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '(not set)',
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? '(set)' : '(not set)',
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? '(set)' : '(not set)',
    
    // Other critical env vars
    NODE_ENV: process.env.NODE_ENV || '(not set)',
    NEXT_RUNTIME: process.env.NEXT_RUNTIME || '(not set)',
    
    // Path information
    PATH: process.env.PATH ? '(set)' : '(not set)',
    PWD: process.env.PWD || '(not set)',
    
    // Verify .env loading
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? '(set)' : '(not set)'
  };
  
  console.log('Environment variables debug:');
  console.log(JSON.stringify(envVars, null, 2));
  
  return envVars;
}
