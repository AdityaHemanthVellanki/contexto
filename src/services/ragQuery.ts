import { client, modelMapping } from '@/lib/azureOpenAI';
import { logUsage } from './usage';

/**
 * Runs a Retrieval-Augmented Generation (RAG) query using Azure OpenAI
 * 
 * @param chunks Array of context chunks for retrieval augmentation
 * @param question The user question to answer
 * @returns Generated answer based on the retrieved context
 */
export async function runRAGQuery(chunks: string[], question: string): Promise<string> {
  try {
    // Build messages array with system prompt and context chunks
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a retrieval-augmented generation assistant.'
      },
      // Include each chunk as a separate user message for context
      ...chunks.map(chunk => ({
        role: 'user' as const,
        content: `Context: ${chunk}`
      })),
      // Add the actual user question
      {
        role: 'user' as const,
        content: `Question: ${question}`
      }
    ];

    // Check total token count - if too large, use the omni model
    // This is a simplistic check; in production you would use a tokenizer
    const totalText = messages.reduce((acc, msg) => acc + msg.content.length, 0);
    const selectedModel = totalText > 12000 ? modelMapping.omni : modelMapping.turbo;

    // Call Azure OpenAI chat completions API
    const response = await client.chat.completions.create({
      model: selectedModel as string,
      messages,
      temperature: 0.3,
      max_tokens: 1000
    });

    const answer = response.choices[0]?.message?.content || '';

    // Log usage
    await logUsage('ragQuery', {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0
    });

    return answer;
  } catch (error) {
    console.error('Error generating RAG response:', error);
    throw new Error(`Failed to generate RAG response: ${error instanceof Error ? error.message : String(error)}`);
  }
}


