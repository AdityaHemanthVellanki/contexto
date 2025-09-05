import { z } from 'zod';

// Define the schema for server-side environment variables
const serverEnvSchema = z.object({
  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, 'Firebase Client Email is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'Firebase Private Key is required'),
  // Optional: Storage bucket may be omitted in some environments; admin SDK can work without it
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  FIREBASE_ADMIN_CREDENTIALS: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Cloudflare R2 (optional)
  CF_R2_ACCOUNT_ID: z.string().optional(),
  CF_R2_ENDPOINT: z.string().optional(),
  CF_R2_BUCKET_NAME: z.string().optional(),
  CF_R2_ACCESS_KEY_ID: z.string().optional(),
  CF_R2_SECRET_ACCESS_KEY: z.string().optional(),
});

// Type for the parsed environment variables
type ServerEnv = z.infer<typeof serverEnvSchema>;

// Cache for the parsed environment variables
let envCache: ServerEnv | null = null;

/**
 * Get and validate server environment variables
 * @returns Parsed and validated environment variables
 * @throws Error if required environment variables are missing or invalid
 */
export const getServerEnv = (): ServerEnv => {
  // Return cached environment if available
  if (envCache) {
    return envCache;
  }

    // Type assertion for process.env to access environment variables safely
  const env = process.env as unknown as {
    // Required Firebase Admin
    FIREBASE_PROJECT_ID: string;
    FIREBASE_CLIENT_EMAIL: string;
    FIREBASE_PRIVATE_KEY: string;
    FIREBASE_STORAGE_BUCKET?: string;
    
    // Optional Firebase Admin
    FIREBASE_ADMIN_CREDENTIALS?: string;
    FIREBASE_SERVICE_ACCOUNT_KEY?: string;
    
    // Node Environment
    NODE_ENV: 'development' | 'production' | 'test';
    
    // Cloudflare R2 (Optional)
    CF_R2_ACCOUNT_ID?: string;
    CF_R2_ENDPOINT?: string;
    CF_R2_BUCKET_NAME?: string;
    CF_R2_ACCESS_KEY_ID?: string;
    CF_R2_SECRET_ACCESS_KEY?: string;
  };

  // Process environment variables with defaults
  const processedEnv = {
    ...env,
    FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n') || '',
    NODE_ENV: env.NODE_ENV || 'development',
  };

  // Parse and validate environment variables
  const parsed = serverEnvSchema.safeParse(processedEnv);

  if (!parsed.success) {
    const errorMessage = parsed.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    
    throw new Error(`Invalid environment variables:\n${errorMessage}`);
  }

  // Create the final environment object with proper typing
  const finalEnv: ServerEnv = {
    ...process.env, // Include all process.env properties
    ...parsed.data, // Include parsed and validated properties
  } as ServerEnv;

  // Cache the parsed environment variables
  envCache = finalEnv;
  
  return finalEnv;
};
