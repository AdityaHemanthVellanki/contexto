import { z } from 'zod';
import { VectorStore } from './vectorStore';

// Azure OpenAI model mapping
const modelMapping = {
  turbo: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
  omni: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI || 'gpt-4o'
};

/**
 * Generate RAG response using retrieved context
 */
export async function generateRAGResponse(
  purpose: string,
  vectorStore: VectorStore,
  fileId: string
): Promise<string> {
  try {
    // 1. Generate embedding for the purpose/query
    const purposeEmbeddings = await generateEmbeddings([purpose]);
    if (!purposeEmbeddings || purposeEmbeddings.length === 0) {
      throw new Error('Failed to generate embeddings for purpose');
    }

    const queryEmbedding = purposeEmbeddings[0].embedding;

    // 2. Retrieve relevant chunks from vector store
    const retrievedChunks = await vectorStore.query(queryEmbedding, 5);
    
    if (retrievedChunks.length === 0) {
      console.warn('No relevant chunks found in vector store');
    }

    // 3. Prepare context from retrieved chunks
    const context = retrievedChunks
      .map((chunk, index) => `[Context ${index + 1}]:\n${chunk.metadata.text}`)
      .join('\n\n');

    // 4. Calculate total tokens to choose appropriate model
    const totalTokens = estimateTokens(context + purpose);
    const selectedModel = totalTokens > 8000 ? modelMapping.omni : modelMapping.turbo;

    console.log(`Using model: ${selectedModel} for ${totalTokens} estimated tokens`);

    // 5. Generate RAG response using Azure OpenAI
    const ragResponse = await callAzureOpenAI(purpose, context, selectedModel);

    // 6. Log usage for analytics
    await logRAGUsage(fileId, purpose, retrievedChunks.length, selectedModel, totalTokens);

    return ragResponse;

  } catch (error) {
    console.error('RAG generation error:', error);
    throw new Error(`Failed to generate RAG response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call Azure OpenAI Chat Completion API
 */
async function callAzureOpenAI(
  purpose: string,
  context: string,
  model: string
): Promise<string> {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
    throw new Error('Azure OpenAI configuration not found');
  }

  const systemPrompt = `You are an expert AI assistant helping users build MCP (Model Context Protocol) pipelines. 

Your task is to analyze the provided context and generate a comprehensive response that addresses the user's stated purpose/problem.

Guidelines:
1. Use the retrieved context to provide specific, actionable insights
2. Focus on solving the user's stated problem or need
3. Be concise but thorough in your analysis
4. If the context doesn't fully address the purpose, acknowledge limitations
5. Provide practical recommendations based on the available data

Context provided: ${context ? 'Yes' : 'No'}
Number of context chunks: ${context.split('[Context').length - 1}`;

  const userPrompt = `Purpose/Problem: ${purpose}

Retrieved Context:
${context || 'No relevant context found in the uploaded file.'}

Please analyze the context and provide a comprehensive response that addresses my purpose/problem.`;

  try {
    const response = await fetch(
      `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${model}/chat/completions?api-version=2024-02-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.7,
          top_p: 0.9
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response generated from Azure OpenAI');
    }

    return data.choices[0].message.content;

  } catch (error) {
    console.error('Azure OpenAI API call failed:', error);
    throw new Error(`Failed to call Azure OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Log RAG usage for analytics
 */
async function logRAGUsage(
  fileId: string,
  purpose: string,
  chunksRetrieved: number,
  model: string,
  estimatedTokens: number
): Promise<void> {
  try {
    const { getFirestoreAdmin } = await import('./firestore-admin');
    const db = getFirestoreAdmin();

    await db.collection('rag_usage').add({
      fileId,
      purpose: purpose.substring(0, 500), // Limit purpose length for storage
      chunksRetrieved,
      model,
      estimatedTokens,
      timestamp: new Date(),
      createdAt: new Date()
    });

    console.log(`Logged RAG usage: ${chunksRetrieved} chunks, ${estimatedTokens} tokens, model: ${model}`);
  } catch (error) {
    console.error('Failed to log RAG usage:', error);
    // Don't throw error for logging failures
  }
}

/**
 * Generate embeddings wrapper (re-export for convenience)
 */
export async function generateEmbeddings(texts: string[]): Promise<Array<{ embedding: number[] }>> {
  const { createEmbeddings } = await import('./embeddings');
  return createEmbeddings(texts);
}
