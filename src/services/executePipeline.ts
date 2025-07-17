import { runDataSource } from './dataSource';
import { runChunker } from './chunker';
import { runEmbedder } from './embeddings';
import { runIndexer } from './indexer';
import { runRetriever } from './retriever';
import { runRAGQuery } from './ragQuery';
import { runOutput } from './output';

/**
 * Pipeline Executor - Main orchestration function for MCP data processing
 * 
 * @param fileId The ID of the file to process
 * @param question The question to answer based on file content
 * @param userIdToken User's Firebase ID token for authentication
 * @returns Object containing answer and retrieved context chunks
 * @throws Error if any part of the pipeline fails
 */
export async function executePipeline(
  fileId: string,
  question: string,
  userIdToken: string
): Promise<{ answer: string, retrieved: string[] }> {
  try {
    console.log(`Starting MCP pipeline execution for file ${fileId}`);
    console.time('pipeline-execution');

    // Step 1: Data Source Node - Extract text from file
    console.log('Step 1: Data Source - Extracting text from file');
    console.time('data-source');
    const text = await runDataSource(fileId, userIdToken);
    console.timeEnd('data-source');
    console.log(`Extracted ${text.length} characters from file`);

    // Step 2: Chunker Node - Split text into manageable chunks
    console.log('Step 2: Chunker - Splitting text into chunks');
    console.time('chunker');
    const chunks = await runChunker(text);
    console.timeEnd('chunker');
    console.log(`Created ${chunks.length} text chunks`);

    // Step 3: Embedder Node - Create embeddings for all chunks
    console.log('Step 3: Embedder - Creating embeddings');
    console.time('embedder');
    const embeddings = await runEmbedder(chunks);
    console.timeEnd('embedder');
    console.log(`Generated ${embeddings.length} embeddings`);

    // Step 4: Indexer Node - Store embeddings and chunks
    console.log('Step 4: Indexer - Storing embeddings and chunks');
    console.time('indexer');
    await runIndexer(fileId, embeddings, chunks);
    console.timeEnd('indexer');
    console.log('Embeddings indexed successfully');

    // Step 5: Retriever Node - Find relevant chunks for the question
    console.log('Step 5: Retriever - Finding relevant chunks');
    console.time('retriever');
    const topChunks = await runRetriever(fileId, question, 5);
    console.timeEnd('retriever');
    console.log(`Retrieved ${topChunks.length} relevant chunks`);

    // Step 6: RAG Query Node - Generate answer based on retrieved chunks
    console.log('Step 6: RAG Query - Generating answer');
    console.time('rag-query');
    const answer = await runRAGQuery(topChunks, question);
    console.timeEnd('rag-query');
    console.log('Answer generated successfully');

    // Step 7: Output Node - Format the final output
    console.log('Step 7: Output - Formatting final result');
    console.time('output');
    const output = await runOutput(answer);
    console.timeEnd('output');
    
    console.timeEnd('pipeline-execution');
    console.log('Pipeline execution completed successfully');

    return { 
      answer: output.answer, 
      retrieved: topChunks 
    };
  } catch (error) {
    // Specific, descriptive error message for debugging
    if (error instanceof Error) {
      throw new Error(`Pipeline execution failed: ${error.message}`);
    }
    
    throw new Error(`Pipeline execution failed: Unknown error`);
  }
}
              // Run RAG query with context and prompt

