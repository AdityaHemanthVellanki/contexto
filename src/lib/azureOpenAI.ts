import OpenAI from 'openai';

/**
 * Validate Azure OpenAI environment variables
 * This provides strict validation with clear error messages
 */
const validateAzureOpenAIEnv = () => {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) return; // Skip validation in browser context
  
  // Extract all required environment variables
  const { 
    AZURE_OPENAI_API_KEY, 
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
    AZURE_OPENAI_DEPLOYMENT_TURBO,
    AZURE_OPENAI_DEPLOYMENT_GPT4,
    AZURE_OPENAI_DEPLOYMENT_OMNI
  } = process.env;
  
  // Required variables and their user-friendly names
  const requiredVars = [
    { name: 'AZURE_OPENAI_API_KEY', value: AZURE_OPENAI_API_KEY },
    { name: 'AZURE_OPENAI_ENDPOINT', value: AZURE_OPENAI_ENDPOINT },
    { name: 'AZURE_OPENAI_DEPLOYMENT_EMBEDDING', value: AZURE_OPENAI_DEPLOYMENT_EMBEDDING }
  ];
  
  // Check for missing required variables - these must be present
  const missingVars = requiredVars
    .filter(v => !v.value)
    .map(v => v.name);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing critical Azure OpenAI environment variables: ${missingVars.join(', ')}. ` +
      `Application cannot function without these. Please check your .env file.`
    );
  }
  
  // Other deployment variables - warn but don't throw
  const optionalVars = [
    { name: 'AZURE_OPENAI_DEPLOYMENT_TURBO', value: AZURE_OPENAI_DEPLOYMENT_TURBO },
    { name: 'AZURE_OPENAI_DEPLOYMENT_GPT4', value: AZURE_OPENAI_DEPLOYMENT_GPT4 },
    { name: 'AZURE_OPENAI_DEPLOYMENT_OMNI', value: AZURE_OPENAI_DEPLOYMENT_OMNI }
  ];
  
  const missingOptionalVars = optionalVars
    .filter(v => !v.value)
    .map(v => v.name);
  
  if (missingOptionalVars.length > 0) {
    console.warn(
      `Warning: Missing Azure OpenAI deployment variables: ${missingOptionalVars.join(', ')}. ` +
      `Some functionality may be limited. Check your .env file.`
    );
  }
  
  // Log the actual environment variables for debugging
  console.log('Azure OpenAI Configuration:');
  console.log(`Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT}`);
  console.log('API Key: [REDACTED]');
  console.log('Deployment Names:');
  console.log(`- Embedding: ${process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002 (fallback)'}`);
  console.log(`- Turbo: ${process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo (fallback)'}`);
  console.log(`- GPT-4: ${process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4 (fallback)'}`);
  console.log(`- Omni: ${process.env.AZURE_OPENAI_DEPLOYMENT_OMNI || 'gpt-4o (fallback)'}`);
};

// Run validation but don't throw errors for missing deployments - we'll use fallbacks
validateAzureOpenAIEnv();

// Check if we're in a browser environment for client-side safety
const isBrowser = typeof window !== 'undefined';

// Define model mapping with safe defaults for browser environments
const modelMapping = isBrowser ? {
  // In browser environments, use placeholder values - these won't actually be used
  // since we don't create the client in the browser, but they prevent undefined errors
  embed: 'text-embedding-ada-002',
  turbo: 'gpt-35-turbo',
  refine: 'gpt-4',
  omni: 'gpt-4o'
} : {
  // In server environments, use actual deployment names with fallbacks
  embed: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002',
  turbo: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo',
  refine: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4',
  omni: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI || 'gpt-4o'
};

// Only validate model mapping in server environments
if (!isBrowser) {
  Object.entries(modelMapping).forEach(([key, value]) => {
    if (!value) {
      console.error(`Error: Model mapping for '${key}' is undefined or empty.`);
    } else {
      console.log(`Model mapping for '${key}': ${value}`);
    }
  });
}

/**
 * Azure OpenAI client singleton
 */
class AzureOpenAIClient {
  private static instance: OpenAI | null = null;
  
  private constructor() {}
  
  public static getClient(): OpenAI {
    // Only create client in server context
    if (isBrowser) {
      throw new Error('Azure OpenAI client cannot be used in browser context');
    }
    
    if (!AzureOpenAIClient.instance) {
      // Validate Azure OpenAI endpoint format
      let endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
      
      // Remove trailing slash if present
      if (endpoint.endsWith('/')) {
        endpoint = endpoint.slice(0, -1);
      }
      
      // Ensure endpoint has the correct format
      if (!endpoint.startsWith('https://')) {
        endpoint = `https://${endpoint}`;
      }
      
      console.log(`Initializing Azure OpenAI client with endpoint: ${endpoint}`);
      
      AzureOpenAIClient.instance = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY as string,
        baseURL: `${endpoint}/openai/deployments`,
        defaultQuery: { 'api-version': '2023-05-15' }, // Use stable API version
        defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY as string }
      });
    }
    
    return AzureOpenAIClient.instance;
  }
}

// Export client getter and model mapping
const client = isBrowser ? null : AzureOpenAIClient.getClient();

export { client, modelMapping };
