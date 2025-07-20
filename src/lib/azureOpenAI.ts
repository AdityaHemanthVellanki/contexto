/**
 * This is a client-safe version of the Azure OpenAI module.
 * It exports placeholder values that are safe to import in client components.
 * 
 * For server components that need to use the actual Azure OpenAI client,
 * import from './azureOpenAI.server.ts' instead.
 */

// Client placeholder - actual client is only available server-side
const client = null;

// Safe model mapping that can be imported on the client
export const modelMapping = {
  embed: 'text-embedding-ada-002',
  'text-embedding-ada-002': 'text-embedding-ada-002',
  'gpt-4': 'gpt-4',
  'gpt-35-turbo': 'gpt-35-turbo',
  // Add client-side placeholders for omni and turbo
  omni: 'gpt-4',
  turbo: 'gpt-35-turbo',
  refine: 'gpt-4'
};

// Safe placeholder for embedding deployment name
export const AZURE_OPENAI_DEPLOYMENT_EMBEDDING = 'text-embedding-ada-002';

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
