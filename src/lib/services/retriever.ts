import chalk from 'chalk';
import { DocumentEmbedder } from './embedder';
import { VectorDatabase, QueryResult } from './vectordb';

export interface RetrievalContext {
  chunks: Array<{
    id: string;
    text: string;
    score: number;
    metadata: any;
  }>;
  totalChunks: number;
  queryTime: number;
  totalTokens: number;
}

export interface PromptContext {
  systemPrompt: string;
  contextChunks: string;
  finalPrompt: string;
  tokenCount: number;
  chunksUsed: number;
}

export class DocumentRetriever {
  private embedder: DocumentEmbedder;
  private vectorDB: VectorDatabase;
  private maxContextTokens: number;

  constructor(
    embedder: DocumentEmbedder,
    vectorDB: VectorDatabase,
    maxContextTokens: number = 3000
  ) {
    this.embedder = embedder;
    this.vectorDB = vectorDB;
    this.maxContextTokens = maxContextTokens;

    console.log(chalk.cyan(`├── 🔍 Retriever initialized (max context: ${maxContextTokens} tokens)`));
  }

  async retrieveContext(
    query: string,
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<RetrievalContext> {
    console.log(chalk.yellow(`├── 🔍 Starting retrieval for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`));
    
    try {
      const startTime = Date.now();

      // Step 1: Embed the query
      console.log(chalk.blue(`├── 📝 Step 1: Embedding query`));
      const queryVector = await this.embedder.embedQuery(query);

      // Step 2: Search vector database
      console.log(chalk.blue(`├── 🔍 Step 2: Searching vector database`));
      const searchResults = await this.vectorDB.queryVectors(queryVector, topK, filter);

      const totalTime = Date.now() - startTime;

      console.log(chalk.green(`├── ✅ Retrieval complete in ${totalTime}ms`));
      console.log(chalk.blue(`├── [Retrieval] Found ${searchResults.totalMatches} relevant chunks`));

      // Log retrieval results
      searchResults.matches.forEach((match, index) => {
        const preview = match.metadata.text.substring(0, 100);
        console.log(chalk.gray(`├── [Result ${index + 1}] Score: ${match.score.toFixed(4)} | "${preview}${match.metadata.text.length > 100 ? '...' : ''}"`));
      });

      return {
        chunks: searchResults.matches.map(match => ({
          id: match.id,
          text: match.metadata.text,
          score: match.score,
          metadata: match.metadata,
        })),
        totalChunks: searchResults.totalMatches,
        queryTime: searchResults.queryTime,
        totalTokens: 0, // Will be calculated in buildPromptContext
      };

    } catch (error) {
      console.error(chalk.red(`├── ❌ Retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Document retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  buildPromptContext(
    retrievalContext: RetrievalContext,
    query: string,
    systemPrompt?: string
  ): PromptContext {
    console.log(chalk.yellow(`├── 🧩 Building prompt context`));

    const defaultSystemPrompt = `You are an expert AI assistant that helps users find information from their documents. 
Use the provided context to answer questions accurately and comprehensively. 
If the context doesn't contain enough information to answer the question, say so clearly.
Always cite which parts of the context you're using in your response.`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    // Build context from retrieved chunks
    let contextChunks = '';
    let tokenCount = this.estimateTokens(finalSystemPrompt + query);
    let chunksUsed = 0;

    console.log(chalk.blue(`├── 📊 Processing ${retrievalContext.totalChunks} retrieved chunks`));

    for (const chunk of retrievalContext.chunks) {
      const chunkHeader = `\n--- CHUNK ${chunksUsed + 1} (Score: ${chunk.score.toFixed(4)}) ---\n`;
      const chunkContent = `${chunkHeader}${chunk.text}\n`;
      const chunkTokens = this.estimateTokens(chunkContent);

      if (tokenCount + chunkTokens <= this.maxContextTokens) {
        contextChunks += chunkContent;
        tokenCount += chunkTokens;
        chunksUsed++;
        
        console.log(chalk.blue(`├── [Context] Added chunk ${chunksUsed} (${chunkTokens} tokens, total: ${tokenCount})`));
      } else {
        console.log(chalk.yellow(`├── [Context] Skipping chunk ${chunksUsed + 1} - would exceed token limit`));
        break;
      }
    }

    const finalPrompt = `${finalSystemPrompt}

Context:
${contextChunks}

User Question: ${query}`;

    console.log(chalk.green(`├── [Prompt] Constructed prompt with ${chunksUsed} retrieved chunks, token count: ${tokenCount}`));

    return {
      systemPrompt: finalSystemPrompt,
      contextChunks,
      finalPrompt,
      tokenCount,
      chunksUsed,
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  async searchSimilarDocuments(
    query: string,
    topK: number = 10,
    filter?: Record<string, any>
  ): Promise<Array<{ docId: string; docName: string; relevanceScore: number; chunkCount: number }>> {
    console.log(chalk.yellow(`├── 📚 Searching for similar documents`));

    try {
      const retrievalContext = await this.retrieveContext(query, topK, filter);
      
      // Group chunks by document
      const docGroups = new Map<string, { docName: string; chunks: any[]; totalScore: number }>();
      
      retrievalContext.chunks.forEach(chunk => {
        const docId = chunk.metadata.docId;
        const docName = chunk.metadata.docName;
        
        if (!docGroups.has(docId)) {
          docGroups.set(docId, { docName, chunks: [], totalScore: 0 });
        }
        
        const group = docGroups.get(docId)!;
        group.chunks.push(chunk);
        group.totalScore += chunk.score;
      });

      // Calculate relevance scores and sort
      const similarDocs = Array.from(docGroups.entries()).map(([docId, group]) => ({
        docId,
        docName: group.docName,
        relevanceScore: group.totalScore / group.chunks.length, // Average score
        chunkCount: group.chunks.length,
      })).sort((a, b) => b.relevanceScore - a.relevanceScore);

      console.log(chalk.green(`├── 📊 Found ${similarDocs.length} relevant documents`));
      similarDocs.forEach((doc, index) => {
        console.log(chalk.gray(`├── [Doc ${index + 1}] ${doc.docName} (score: ${doc.relevanceScore.toFixed(4)}, chunks: ${doc.chunkCount})`));
      });

      return similarDocs;

    } catch (error) {
      console.error(chalk.red(`├── ❌ Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const createRetriever = (
  embedder: DocumentEmbedder,
  vectorDB: VectorDatabase,
  maxContextTokens?: number
) => {
  return new DocumentRetriever(embedder, vectorDB, maxContextTokens);
};
