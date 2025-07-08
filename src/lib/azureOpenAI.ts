import OpenAI from 'openai';

/**
 * Validate Azure OpenAI environment variables
 * This strictly enforces that all required variables are present in server context
 */
const validateAzureOpenAIEnv = () => {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) return; // Skip validation in browser context
  
  const requiredVars = [
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_DEPLOYMENT_EMBEDDING',
    'AZURE_OPENAI_DEPLOYMENT_TURBO',
    'AZURE_OPENAI_DEPLOYMENT_GPT4',
    'AZURE_OPENAI_DEPLOYMENT_OMNI'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Azure OpenAI environment variables: ${missingVars.join(', ')}. ` +
      `Please check your .env file or environment configuration.`
    );
  }
};

// Validate environment variables - throw error if any are missing
validateAzureOpenAIEnv();

// Check if we're in a browser environment for client-side safety
const isBrowser = typeof window !== 'undefined';

// Define model mapping for easier reference - no fallbacks in production
const modelMapping = {
  embed: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING as string,
  turbo: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO as string,
  refine: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 as string,
  omni: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI as string
};

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
      AzureOpenAIClient.instance = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY as string,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments`,
        defaultQuery: { 'api-version': '2023-12-01-preview' },
        defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY as string }
      });
    }
    
    return AzureOpenAIClient.instance;
  }
}

// Export client getter and model mapping
const client = isBrowser ? null : AzureOpenAIClient.getClient();

export { client, modelMapping };
