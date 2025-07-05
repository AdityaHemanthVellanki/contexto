import OpenAI from 'openai';

// Define required environment variables
const requiredEnvVars = [
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_DEPLOYMENT_EMBEDDING',
  'AZURE_OPENAI_DEPLOYMENT_TURBO',
  'AZURE_OPENAI_DEPLOYMENT_GPT4',
  'AZURE_OPENAI_DEPLOYMENT_OMNI'
];

// For development mode, show warnings instead of throwing errors
const isDevelopment = process.env.NODE_ENV === 'development';
const missingVars: string[] = [];

// Check for missing environment variables
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    if (!isDevelopment) {
      throw new Error(`Missing ${varName} environment variable`);
    }
  }
});

// Show warning in development mode
if (isDevelopment && missingVars.length > 0) {
  console.warn(`
    ⚠️ Missing Azure OpenAI environment variables: ${missingVars.join(', ')}.
    Using placeholder values for development.
    Please set these in .env.local for proper functionality.
    Note: Azure OpenAI features will be limited in development mode without proper credentials.
  `);
}

// Define model mapping for easier reference with fallbacks for development
export const modelMapping = {
  embedding: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002',
  turbo: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo',
  gpt4: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4',
  omni: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI || 'gpt-4-vision'
};

// Add warning if we're using demo values in development
if (isDevelopment && missingVars.length > 0) {
  console.log('🧠 Using demo Azure OpenAI configuration for development');
  console.log('🧠 Azure OpenAI features will be limited or unavailable');
}

// Initialize the Azure OpenAI client with fallbacks for development
let openai: OpenAI;

try {
  openai = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'demo-key-for-development',
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT || 'https://api.openai.com'}/openai/deployments`,
    defaultQuery: { 'api-version': '2023-12-01-preview' },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY || 'demo-key-for-development' }
  });
} catch (error) {
  if (isDevelopment) {
    console.error('Error initializing Azure OpenAI client:', error);
    // Create a mock client for development
    openai = {} as OpenAI;
  } else {
    throw error;
  }
}

export default openai;
