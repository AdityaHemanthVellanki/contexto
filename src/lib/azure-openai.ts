import OpenAI from 'openai';

/**
 * Get a configured Azure OpenAI client
 * @returns A configured OpenAI client for Azure
 */
export function getAzureOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments`,
    defaultQuery: { 'api-version': '2023-12-01-preview' },
    defaultHeaders: {
      'api-key': process.env.AZURE_OPENAI_API_KEY,
    },
  });
}

// Azure OpenAI client configuration
const openai = getAzureOpenAIClient();

/**
 * Generate embeddings using Azure OpenAI
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING!,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Azure OpenAI embedding error:', error);
    throw new Error('Failed to generate embeddings');
  }
}

/**
 * Generate chat completion using Azure OpenAI
 */
export async function generateChatCompletion(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  model: 'turbo' | 'gpt4' | 'omni' = 'turbo',
  stream: boolean = false
): Promise<any> {
  try {
    const deploymentMap = {
      turbo: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO!,
      gpt4: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4!,
      omni: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI!
    };

    const response = await openai.chat.completions.create({
      model: deploymentMap[model],
      messages,
      stream,
      temperature: 0.7,
      max_tokens: 2000
    });

    return response;
  } catch (error) {
    console.error('Azure OpenAI chat completion error:', error);
    throw new Error('Failed to generate chat completion');
  }
}

/**
 * Stream chat completion using Azure OpenAI
 */
export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  model: 'turbo' | 'gpt4' | 'omni' = 'turbo'
) {
  try {
    const deploymentMap = {
      turbo: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO!,
      gpt4: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4!,
      omni: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI!
    };

    const response = await fetch(
      `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deploymentMap[model]}/chat/completions?api-version=2024-02-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY!,
        },
        body: JSON.stringify({
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2000
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('Azure OpenAI streaming error:', error);
    throw new Error('Failed to stream chat completion');
  }
}
