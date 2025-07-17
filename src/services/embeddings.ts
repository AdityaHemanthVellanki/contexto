import client, { modelMapping, AZURE_OPENAI_DEPLOYMENT_EMBEDDING } from '@/lib/azureOpenAI.server';
import { logUsage } from './usage';

/**
 * Embedder node - Creates embeddings for text chunks using Azure OpenAI
 * 
 * @param chunks Array of text chunks to embed
 * @returns Array of embedding vectors
 * @throws Error if embedding generation fails
 */
export async function runEmbedder(chunks: string[]): Promise<number[][]> {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    console.warn('Embeddings cannot be generated in browser environment');
    throw new Error('Embeddings can only be generated on the server');
  }

  if (!chunks || chunks.length === 0) {
    throw new Error('No text chunks provided for embedding');
  }

  console.time('embedder');
  console.log('Step 3: Embedder - Creating embeddings');

  const result: number[][] = [];
  const batchSize = 100; // Process in batches to avoid API limits

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(chunks.length / batchSize);

    console.log(`Processing embedding batch ${batchNumber} of ${totalBatches}`);
    console.log(`Using Azure OpenAI deployment: ${AZURE_OPENAI_DEPLOYMENT_EMBEDDING}`);

    try {
      // For Azure OpenAI, we need to use the deploymentId format
      const response = await client.embeddings.create({
        model: AZURE_OPENAI_DEPLOYMENT_EMBEDDING as string,
        input: batchChunks
      }, {
        path: `/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_EMBEDDING}/embeddings`
      });

      if (response.data && response.data.length > 0) {
        const batchEmbeddings = response.data.map((d: any) => d.embedding);

        try {
          await logUsage('embed', {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: 0
          }, 'system');
        } catch (logError) {
          // Continue even if logging fails
          console.warn('Failed to log usage metrics:', logError instanceof Error ? logError.message : 'Unknown error');
        }

        result.push(...batchEmbeddings);
        console.log(`Successfully generated ${batchEmbeddings.length} embeddings for batch ${batchNumber}`);
      } else {
        throw new Error('No embedding data returned from Azure OpenAI');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Embedding batch ${batchNumber} failed:`, errorMessage);

      // Provide specific error guidance
      if (errorMessage.includes('404')) {
        console.error(`❌ 404 Error: Check that AZURE_OPENAI_DEPLOYMENT_EMBEDDING (${AZURE_OPENAI_DEPLOYMENT_EMBEDDING}) matches your Azure portal deployment name exactly.`);
      } else if (errorMessage.includes('401')) {
        console.error('❌ 401 Error: Check your AZURE_OPENAI_API_KEY is correct.');
      } else if (errorMessage.includes('403')) {
        console.error('❌ 403 Error: Check your Azure OpenAI permissions and quota.');
      }

      throw new Error(`Failed to generate embeddings: ${errorMessage}`);
    }
  }

  console.timeEnd('embedder');
  return result;
}
