/**
 * Output node - Wrap answer with any additional metadata
 * 
 * @param answer The generated answer from RAG query
 * @returns Object containing the answer and optional metadata
 */
export async function runOutput(answer: string): Promise<{ answer: string }> {
  if (!answer) {
    throw new Error('Output failed: No answer provided');
  }

  // Simply wrap and return the answer
  // This could be extended with formatting or additional metadata if needed
  return { 
    answer 
  };
}
