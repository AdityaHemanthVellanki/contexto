import { client, modelMapping } from '@/lib/azureOpenAI';
import { logUsage } from './usage';

/**
 * Generates a summary of the provided text using Azure OpenAI
 * 
 * @param text The text to summarize
 * @returns A concise summary of the input text
 */
export async function runSummarizer(text: string): Promise<string> {
  try {
    // Call Azure OpenAI chat completions API
    const response = await client.chat.completions.create({
      model: modelMapping.turbo as string,
      messages: [
        {
          role: 'system',
          content: 'You are a summarization assistant.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.5,
      max_tokens: 500
    });

    const summary = response.choices[0]?.message?.content || '';

    // Log usage
    await logUsage('summarizer', {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0
    });

    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`);
  }
}


