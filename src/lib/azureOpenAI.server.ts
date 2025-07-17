import { OpenAI } from 'openai';

// Validate Azure OpenAI environment variables on startup
const { AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_EMBEDDING } = process.env;

if (!AZURE_OPENAI_API_KEY) {
  throw new Error("Missing AZURE_OPENAI_API_KEY");
}

if (!AZURE_OPENAI_ENDPOINT) {
  throw new Error("Missing AZURE_OPENAI_ENDPOINT");
}

if (!AZURE_OPENAI_DEPLOYMENT_EMBEDDING) {
  throw new Error("Missing AZURE_OPENAI_DEPLOYMENT_EMBEDDING");
}

// Additional validation for endpoint format
if (!AZURE_OPENAI_ENDPOINT.startsWith('https://')) {
  throw new Error("AZURE_OPENAI_ENDPOINT must start with https://");
}

if (AZURE_OPENAI_ENDPOINT.endsWith('/')) {
  throw new Error("AZURE_OPENAI_ENDPOINT must not end with a trailing slash");
}

// Model mapping for Azure OpenAI deployments
export const modelMapping = {
  embed: AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
  'text-embedding-ada-002': AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
  'gpt-4': process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4',
  'gpt-35-turbo': process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo',
  // Add missing properties used in RAG query
  omni: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4',
  turbo: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo'
};

// Create Azure OpenAI client with validated environment variables
const client = new OpenAI({
  apiKey: AZURE_OPENAI_API_KEY,
  baseURL: AZURE_OPENAI_ENDPOINT,
  defaultQuery: { 'api-version': '2023-05-15' },
  defaultHeaders: {
    'api-key': AZURE_OPENAI_API_KEY
  }
});

console.log('✅ Azure OpenAI client initialized successfully');
console.log(`📍 Endpoint: ${AZURE_OPENAI_ENDPOINT}`);
console.log(`🚀 Embedding deployment: ${AZURE_OPENAI_DEPLOYMENT_EMBEDDING}`);

export default client;
export { AZURE_OPENAI_DEPLOYMENT_EMBEDDING };
