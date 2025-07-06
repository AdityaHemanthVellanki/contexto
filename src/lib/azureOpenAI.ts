import OpenAI from 'openai';

// Check for required environment variables
if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
  throw new Error('Missing required Azure OpenAI environment variables: AZURE_OPENAI_API_KEY and/or AZURE_OPENAI_ENDPOINT');
}

// Define model mapping for easier reference
const modelMapping = {
  embed: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
  turbo: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO,
  refine: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
  omni: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI
};

// Initialize the Azure OpenAI client
const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments`,
  defaultQuery: { 'api-version': '2023-12-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY }
});

export { client, modelMapping };
