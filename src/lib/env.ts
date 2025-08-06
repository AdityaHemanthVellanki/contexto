// src/lib/env.ts
/**
 * Environment variable utilities with TypeScript types
 */

import getConfig from 'next/config';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Server-side environment variables
type ServerEnv = {
  // Node Environment
  NODE_ENV: 'development' | 'production' | 'test';
  PORT?: string;
  
  // Application
  NEXT_PUBLIC_APP_URL?: string;
  
  // Authentication
  ADMIN_USER_ID?: string;
  
  // Azure OpenAI
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_DEPLOYMENT_EMBEDDING?: string;
  AZURE_OPENAI_DEPLOYMENT_TURBO?: string;
  AZURE_OPENAI_DEPLOYMENT_GPT4?: string;
  AZURE_OPENAI_DEPLOYMENT_OMNI?: string;
  AZURE_OPENAI_API_DEPLOYMENT?: string; // Legacy
  AZURE_OPENAI_KEY?: string; // Legacy
  AZURE_OPENAI_DEPLOYID?: string; // Legacy
  
  // Vector Stores
  PINECONE_API_KEY?: string;
  PINECONE_ENVIRONMENT?: string;
  PINECONE_INDEX?: string;
  PINECONE_ENV?: string; // Legacy
  QDRANT_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  
  // Cloudflare R2
  CF_R2_ENDPOINT?: string;
  CF_R2_ACCESS_KEY_ID?: string;
  CF_R2_SECRET_ACCESS_KEY?: string;
  CF_R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  
  // Deployment
  RENDER_TOKEN?: string;
  RENDER_REGION?: string;
  RENDER_PLAN?: string;
  HEROKU_API_KEY?: string; // Legacy
  HEROKU_TEAM?: string; // Legacy
  HEROKU_REGION?: string; // Legacy
  
  // Firebase (for client-side, but needed in server for some operations)
  NEXT_PUBLIC_FIREBASE_API_KEY?: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  NEXT_PUBLIC_FIREBASE_APP_ID?: string;
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
  
  // Development
  THROW_ON_MISSING_ENV?: string;
  
  // Add index signature for dynamic access
  [key: string]: string | undefined;
};

// Client-side environment variables
type PublicEnv = Pick<ServerEnv, 
  'NODE_ENV' | 
  'NEXT_PUBLIC_APP_URL' |
  'R2_PUBLIC_URL' |
  'NEXT_PUBLIC_FIREBASE_API_KEY' |
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN' |
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID' |
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET' |
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID' |
  'NEXT_PUBLIC_FIREBASE_APP_ID' |
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID' |
  'NEXT_PUBLIC_PINECONE_ENVIRONMENT' |
  'NEXT_PUBLIC_PINECONE_INDEX' |
  'NEXT_PUBLIC_SUPABASE_URL'
> & {
  // Add index signature for dynamic access to public env vars
  [key: string]: string | undefined;
};

// Type for the complete environment
type Env = ServerEnv & PublicEnv;

// Default values for environment variables (for development)
const defaultServerEnv: ServerEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  THROW_ON_MISSING_ENV: 'false',
  
  // Azure OpenAI
  AZURE_OPENAI_API_KEY: '',
  AZURE_OPENAI_ENDPOINT: '',
  AZURE_OPENAI_DEPLOYMENT_EMBEDDING: '',
  AZURE_OPENAI_DEPLOYMENT_TURBO: '',
  AZURE_OPENAI_DEPLOYMENT_GPT4: '',
  AZURE_OPENAI_DEPLOYMENT_OMNI: '',
  AZURE_OPENAI_API_DEPLOYMENT: '',
  AZURE_OPENAI_KEY: '',
  AZURE_OPENAI_DEPLOYID: '',
  
  // Vector Stores
  PINECONE_API_KEY: '',
  PINECONE_ENVIRONMENT: '',
  PINECONE_INDEX: '',
  PINECONE_ENV: '',
  QDRANT_API_KEY: '',
  SUPABASE_URL: '',
  SUPABASE_SERVICE_KEY: '',
  
  // Cloudflare R2
  CF_R2_ENDPOINT: '',
  CF_R2_ACCESS_KEY_ID: '',
  CF_R2_SECRET_ACCESS_KEY: '',
  CF_R2_BUCKET_NAME: '',
  R2_PUBLIC_URL: '',
  
  // Deployment
  RENDER_TOKEN: '',
  RENDER_REGION: 'iad',
  RENDER_PLAN: 'free',
  HEROKU_API_KEY: '',
  HEROKU_TEAM: '',
  HEROKU_REGION: '',
  
  // Firebase
  NEXT_PUBLIC_FIREBASE_API_KEY: '',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: '',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: '',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '',
  NEXT_PUBLIC_FIREBASE_APP_ID: '',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: '',
  
  // Authentication
  ADMIN_USER_ID: ''
};

// Extend NodeJS.ProcessEnv with our custom environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv extends ServerEnv, PublicEnv {}
    
    interface Process {
      env: ProcessEnv;
      cwd(): string;
    }
  }
}

/**
 * Get server environment variables
 */
export function getServerEnv(): ServerEnv {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || '',
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
    PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
    PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT || '',
    PINECONE_INDEX: process.env.PINECONE_INDEX || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    CF_R2_ACCESS_KEY_ID: process.env.CF_R2_ACCESS_KEY_ID || '',
    CF_R2_SECRET_ACCESS_KEY: process.env.CF_R2_SECRET_ACCESS_KEY || '',
    CF_R2_BUCKET_NAME: process.env.CF_R2_BUCKET_NAME || '',
    CF_R2_ENDPOINT: process.env.CF_R2_ENDPOINT || '',
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '',
    ADMIN_USER_ID: process.env.ADMIN_USER_ID || '',
  };
}

/**
 * Get public environment variables (safe for client-side)
 */
export function getPublicEnv(): PublicEnv {
  try {
    const { publicRuntimeConfig = {} } = getConfig() || {};
    
    // Get all env vars with proper typing
    const processEnv = process.env as unknown as NodeJS.ProcessEnv;
    
    // Filter for public environment variables
    const publicVars: Record<string, string> = {};
    const allVars = {
      ...processEnv,
      ...publicRuntimeConfig
    } as Record<string, string>;
    
    // Only expose variables that are explicitly marked as public
    Object.keys(allVars).forEach(key => {
      if (key.startsWith('NEXT_PUBLIC_') || key === 'NODE_ENV' || key === 'R2_PUBLIC_URL') {
        publicVars[key] = allVars[key] || '';
      }
    });
    
    // Set NODE_ENV if not set
    if (!publicVars.NODE_ENV) {
      publicVars.NODE_ENV = 'development';
    }
    
    // Check for missing required public variables
    const requiredPublicVars: (keyof PublicEnv)[] = [
      'NEXT_PUBLIC_APP_URL',
      'R2_PUBLIC_URL',
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'
    ];
    
    const missingVars = requiredPublicVars.filter(key => !publicVars[key]);
    
    if (missingVars.length > 0 && publicVars.NODE_ENV !== 'test') {
      const errorMessage = `Missing required public environment variables: ${missingVars.join(', ')}`;
      console.error('❌', errorMessage);
      
      if (publicVars.NODE_ENV === 'production' || publicVars.THROW_ON_MISSING_ENV === 'true') {
        throw new Error(errorMessage);
      }
      
      console.warn('⚠️  Continuing with missing public environment variables in development mode');
    }
    
    // Create the public env object with proper typing
    const publicEnv: PublicEnv = {
      NODE_ENV: publicVars.NODE_ENV as 'development' | 'production' | 'test',
      NEXT_PUBLIC_APP_URL: publicVars.NEXT_PUBLIC_APP_URL || '',
      R2_PUBLIC_URL: publicVars.R2_PUBLIC_URL || '',
      NEXT_PUBLIC_FIREBASE_API_KEY: publicVars.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: publicVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: publicVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: publicVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: publicVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      NEXT_PUBLIC_FIREBASE_APP_ID: publicVars.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: publicVars.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
      NEXT_PUBLIC_PINECONE_ENVIRONMENT: publicVars.NEXT_PUBLIC_PINECONE_ENVIRONMENT || '',
      NEXT_PUBLIC_PINECONE_INDEX: publicVars.NEXT_PUBLIC_PINECONE_INDEX || '',
      NEXT_PUBLIC_SUPABASE_URL: publicVars.NEXT_PUBLIC_SUPABASE_URL || '',
      // Add index signature for dynamic access
      ...publicVars
    };
    
    return publicEnv;
  } catch (error) {
    console.error('Error loading public environment variables:', error);
    return {} as PublicEnv;
  }
}

/**
 * Get the current working directory
 * @returns The current working directory path
 */
export function getCwd(): string {
  const cwd = process.cwd();
  return cwd;
}

/**
 * Check if the application is running in production mode
 * @returns boolean indicating if in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if the application is running in development mode
 * @returns boolean indicating if in development
 */
export function isDevelopment(): boolean {
  return !isProduction();
}
