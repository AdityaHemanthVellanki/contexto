import OpenAI from 'openai';
import fetch from 'node-fetch';

// Interface for embedding results
interface EmbeddingResult {
  text: string;
  embedding: number[];
}

/**
 * Create embeddings for text chunks using Azure OpenAI
 * @param chunks Array of text chunks to embed
 * @param pipelineId Optional pipeline ID for tracking
 * @returns Array of embedding results
 */
export async function createEmbeddings(
  chunks: string[],
  pipelineId?: string
): Promise<EmbeddingResult[]> {
  // Get Azure OpenAI configuration
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  
  // Try to get embedding deployment name from different possible env var keys
  const embeddingDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 
    process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 
    process.env.AZURE_OPENAI_DEPLOYMENT || 
    'text-embedding-ada-002'; // Default name if no env var set
  
  // Log deployment name and API endpoint
  console.log(`Using Azure OpenAI embedding deployment: ${embeddingDeployment}`);
  console.log(`Azure endpoint: ${azureEndpoint}`);
  
  // Validate API configuration
  if (!azureApiKey) {
    console.error('Missing AZURE_OPENAI_API_KEY environment variable');
    throw new Error('Azure OpenAI API key not configured');
  }
  
  if (!azureEndpoint) {
    console.error('Missing AZURE_OPENAI_ENDPOINT environment variable');
    throw new Error('Azure OpenAI endpoint not configured');
  }

  try {
      'text-embedding-ada-002'; // Default name if no env var set

    // Log deployment name and API endpoint
    console.log(`Using Azure OpenAI embedding deployment: ${deployment}`);
    console.log(`Azure endpoint: ${process.env.AZURE_OPENAI_ENDPOINT}`);

    // Use Azure OpenAI API
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;

    if (!azureApiKey || !azureEndpoint) {
      throw new Error('Missing Azure OpenAI API key or endpoint');
    }

    // Fix the URL format to avoid double-slash issues
    const baseUrl = azureEndpoint.replace(/\/$/, '');
    const azurePath = `/openai/deployments/${deployment}/embeddings`;
    const url = `${baseUrl}${azurePath}`;

    // Process the texts in batches to avoid token limits
    const embeddings: number[][] = [];
    const batchSize = 16; // Azure OpenAI can handle multiple texts in one request

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing embedding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
      
      // Make the API request
      console.log(`Azure OpenAI embedding request URL: ${url}`);
      console.log(`Using deployment: ${deployment}`);
      
      // Add API version parameter to the request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureApiKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          input: batch,
          model: deployment // Required by Azure OpenAI
        })
      });

      // Check for errors
      if (!response.ok) {
        // Special handling for 404 errors which likely mean the deployment name is wrong
        if (response.status === 404) {
          console.error(`Error 404: Deployment '${deployment}' not found at ${baseUrl}`);
          console.log('Available environment variables:', { 
            AZURE_OPENAI_DEPLOYMENT_EMBEDDING: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING, 
            AZURE_OPENAI_EMBEDDING_DEPLOYMENT: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT, 
            AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT
          });
          
          // Try other common deployment names as a last resort
          const otherPossibleDeployments = ['text-embedding-ada-002', 'embedding', 'ada-embedding', 'text-embedding'];
          if (!otherPossibleDeployments.includes(deployment)) {
            for (const altName of otherPossibleDeployments) {
              console.log(`Trying alternate embedding deployment name: ${altName}`);
              const altUrl = `${baseUrl}/openai/deployments/${altName}/embeddings`;
              try {
                const altResponse = await fetch(altUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'api-key': azureApiKey,
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify({
                    input: batch.slice(0, 1), // Just try with one item to test
                    model: altName
                  })
                });
                
                if (altResponse.ok) {
                  console.log(`Success with alternate deployment name: ${altName}`);
                  const data = await altResponse.json();
                  const embedResult = data.data?.map((item: any) => item.embedding) || [];
                  
                  // If we got a successful result, use this deployment for the rest
                  if (embedResult.length > 0) {
                    console.log(`Switching to working deployment: ${altName}`);
                    // Process the rest of the batch with the working deployment
                    const fullResponse = await fetch(altUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'api-key': azureApiKey,
                        'Accept': 'application/json'
                      },
                      body: JSON.stringify({
                        input: batch,
                        model: altName
                      })
                    });
                    
                    if (fullResponse.ok) {
                      const fullData = await fullResponse.json();
                      const batchEmbeddings = fullData.data?.map((item: any) => item.embedding) || [];
                      embeddings.push(...batchEmbeddings);
                      continue; // Skip the error and go to the next batch
                    }
                  }
                }
              } catch (altError) {
                console.log(`Failed with alternate deployment: ${altName}`);
              }
            if (responseData.data[j] && responseData.data[j].embedding) {
              results.push({
                text: batchChunks[j],
                embedding: responseData.data[j].embedding
              });
            } else {
              console.warn(`Missing embedding data for chunk ${j} in batch ${Math.floor(i/batchSize) + 1}`);
            }
          }
        } else {
          throw new Error('Invalid response format from embedding API: ' + JSON.stringify(responseData));
        }
      } catch (batchError) {
        console.error(`Error in embedding batch ${Math.floor(i/batchSize) + 1}:`, batchError);
        throw batchError;
      }
    }

    return results;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if Azure OpenAI is properly configured
 * @returns Boolean indicating if Azure OpenAI is configured
 */
function isAzureOpenAIConfigured(): boolean {
  return Boolean(
    azureApiKey && 
    azureEndpoint && 
    embeddingDeployment
  );
}

/**
 * Find similar chunks using vector similarity search
 * @param query The query text to find similar chunks for
 * @param pipelineId The ID of the pipeline to search within
 * @param topK Number of results to return
 * @returns Array of similar chunks with similarity scores
 */
export async function findSimilarChunks(
  query: string, 
  pipelineId: string,
  topK: number = 5
): Promise<{text: string, score: number}[]> {
  try {
    // Check if Azure OpenAI is configured before attempting to create embeddings
    if (!isAzureOpenAIConfigured()) {
      console.warn('Azure OpenAI is not configured correctly. Using fallback search method.');
      return useFallbackSearch(query, topK);
    }
    
    try {
      // First, create an embedding for the query
      const queryEmbeddingResults = await createEmbeddings([query]);
      if (!queryEmbeddingResults.length) {
        throw new Error('Failed to generate query embedding');
      }
      
      const queryEmbedding = queryEmbeddingResults[0].embedding;
      
      // In production, use a vector database like Pinecone, FAISS, or Qdrant
      // For this implementation, we'll use a simulated vector search
      
      // TODO: Replace with actual vector DB integration
      // Example simulated response structure
      return [
        { 
          text: "This is a similar chunk #1 found for your query '" + query + "'. This would normally use vector similarity search.", 
          score: 0.92 
        },
        { 
          text: "This is a similar chunk #2 related to '" + query + "'. In a production system, this would use embeddings from Azure OpenAI.", 
          score: 0.87 
        },
        { 
          text: "Additional information about '" + query + "' would be found in your indexed documents.", 
          score: 0.83 
        },
        { 
          text: "Fourth relevant result for '" + query + "' from your knowledge base.", 
          score: 0.78 
        },
        { 
          text: "Fifth most relevant chunk about '" + query + "', with contextually relevant information.", 
          score: 0.72 
        }
      ];
    } catch (embeddingError) {
      console.error('Error with embeddings, falling back to alternative search:', embeddingError);
      return useFallbackSearch(query, topK);
    }
  } catch (error) {
    console.error('Error finding similar chunks:', error);
    // Rather than completely failing, provide a fallback response
    return useFallbackSearch(query, topK);
  }
}

/**
 * Fallback search implementation when Azure OpenAI is not available
 * @param query The search query
 * @param topK Number of results to return
 * @returns Array of text chunks with simulated similarity scores
 */
function useFallbackSearch(query: string, topK: number = 5): Array<{text: string, score: number}> {
  console.log('Using fallback search for query:', query);
  
  // Return static results that acknowledge the query but don't rely on embeddings
  return [
    { 
      text: `I found this information about "${query}". Note: The embedding service is currently unavailable, so these are simulated results.`, 
      score: 0.95 
    },
    { 
      text: `Here's what I know about "${query}" from your documents (fallback mode).`, 
      score: 0.90 
    },
    { 
      text: `Additional context about "${query}" would normally be retrieved from your indexed content.`, 
      score: 0.85 
    },
    { 
      text: `This is a placeholder result for "${query}" since the embedding service is unavailable.`, 
      score: 0.80 
    },
    { 
      text: `To get more accurate results for "${query}", please check your Azure OpenAI configuration.`, 
      score: 0.75 
    }
  ].slice(0, topK);
}
