import { client, modelMapping } from '@/lib/azureOpenAI';
import { logUsage } from './usage';

/**
 * Refines a draft answer using Azure OpenAI
 * 
 * @param draft Draft text to refine
 * @param instructions Optional instructions for refinement
 * @returns Refined version of the draft text
 */
export async function runRefineAnswer(draft: string, instructions?: string): Promise<string> {
  try {
    // Build messages array with system prompt, draft, and optional instructions
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a refinement assistant.'
      },
      {
        role: 'user' as const,
        content: draft
      }
    ];

    // Add instructions if provided
    if (instructions) {
      messages.push({
        role: 'user' as const,
        content: `Instructions for refinement: ${instructions}`
      });
    }

    // Call Azure OpenAI chat completions API
    const response = await client.chat.completions.create({
      model: modelMapping.refine as string,
      messages,
      temperature: 0.2,
      max_tokens: 1500
    });

    const refinedAnswer = response.choices[0]?.message?.content || '';

    // Log usage
    await logUsage('refine', {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0
    });

    return refinedAnswer;
  } catch (error) {
    console.error('Error refining answer:', error);
    throw new Error(`Failed to refine answer: ${error instanceof Error ? error.message : String(error)}`);
  }
}


