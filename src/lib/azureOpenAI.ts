/**
 * This is a client-safe version of the Azure OpenAI module.
 * It exports values that are safe to import in client components.
 * 
 * For server components that need to use the actual Azure OpenAI client,
 * import from './azureOpenAI.server.ts' instead.
 */

// Client-safe version - actual client is only available server-side
const client = null;

// Safe model mapping that can be imported on the client
export const modelMapping = {
  embed: process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002',
  'text-embedding-ada-002': process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002',
  'gpt-4': process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4',
  'gpt-35-turbo': process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo',
  // Add model mappings for RAG query operations
  omni: process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4',
  turbo: process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo',
  refine: process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4'
};

// Client-safe export for embedding deployment name
export const AZURE_OPENAI_DEPLOYMENT_EMBEDDING = process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-ada-002';

// Export the client as default
export default client;

// Add a "use server" directive to warn users that try to use this on the client
export function getAzureOpenAIClient() {
  console.error(
    'Error: Azure OpenAI client can only be used in server components.\n' +
    'Import from \'@/lib/azureOpenAI.server\' in server components only.'
  );
  return null;
}
