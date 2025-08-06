import { OpenAI } from 'openai';
import chalk from 'chalk';
import { ChunkResult } from './chunker';

export interface EmbeddingResult {
  embeddings: Array<{
    id: string;
    vector: number[];
    text: string;
    metadata: any;
    dimensions: number;
  }>;
  totalEmbeddings: number;
  model: string;
  totalTokens: number;
}

export class DocumentEmbedder {
  private openai: OpenAI;
  private model: string;
  private batchSize: number;

  constructor(
    apiKey: string,
    model: string = 'text-embedding-3-small',
    batchSize: number = 100
  ) {
    if (!apiKey) {
      console.error(chalk.red('├── ❌ OpenAI API key is missing!'));
      throw new Error('OpenAI API key is required for embedding service');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = model;
    this.batchSize = batchSize;

    console.log(chalk.cyan(`├── 🧠 Embedder initialized (model: ${model}, batch: ${batchSize})`));
  }

  async embedChunks(chunkResult: ChunkResult): Promise<EmbeddingResult> {
    console.log(chalk.yellow(`├── 🔄 Starting embedding process for ${chunkResult.totalChunks} chunks`));
    
    const startTime = Date.now();
    const embeddings: EmbeddingResult['embeddings'] = [];
    let totalTokens = 0;

    try {
      // Process chunks in batches to respect API limits
      for (let i = 0; i < chunkResult.chunks.length; i += this.batchSize) {
        const batch = chunkResult.chunks.slice(i, i + this.batchSize);
        const batchTexts = batch.map(chunk => chunk.text);
        
        console.log(chalk.blue(`├── 📦 Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(chunkResult.chunks.length / this.batchSize)} (${batch.length} chunks)`));

        try {
          const response = await this.openai.embeddings.create({
            model: this.model,
            input: batchTexts,
            encoding_format: 'float',
          });

          // Log API response details
          console.log(chalk.green(`├── ✅ OpenAI API response received`));
          console.log(chalk.gray(`├── 📊 Tokens used: ${response.usage?.total_tokens || 'unknown'}`));
          console.log(chalk.gray(`├── 🔢 Vectors generated: ${response.data.length}`));

          totalTokens += response.usage?.total_tokens || 0;

          // Process each embedding in the batch
          response.data.forEach((embedding, batchIndex) => {
            const chunkIndex = i + batchIndex;
            const chunk = batch[batchIndex];
            
            const embeddingResult = {
              id: chunk.id,
              vector: embedding.embedding,
              text: chunk.text,
              metadata: {
                ...chunk.metadata,
                embeddingModel: this.model,
                embeddedAt: new Date().toISOString(),
              },
              dimensions: embedding.embedding.length,
            };

            embeddings.push(embeddingResult);

            console.log(chalk.blue(`├── [Embedding] Chunk ${chunkIndex} → Vector (${embedding.embedding.length}-dim)`));
          });

          // Add delay between batches to respect rate limits
          if (i + this.batchSize < chunkResult.chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (batchError) {
          console.error(chalk.red(`├── ❌ Batch ${Math.floor(i / this.batchSize) + 1} failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`));
          throw batchError;
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(chalk.green(`├── 🎉 Embedding complete in ${processingTime}ms`));
      console.log(chalk.green(`├── 📊 Total embeddings: ${embeddings.length}`));
      console.log(chalk.green(`├── 🔢 Vector dimensions: ${embeddings[0]?.dimensions || 'N/A'}`));
      console.log(chalk.green(`├── 🎫 Total tokens used: ${totalTokens}`));

      return {
        embeddings,
        totalEmbeddings: embeddings.length,
        model: this.model,
        totalTokens,
      };

    } catch (error) {
      console.error(chalk.red(`├── ❌ Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Embedding process failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedQuery(query: string): Promise<number[]> {
    console.log(chalk.yellow(`├── 🔍 Embedding query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`));
    
    try {
      const startTime = Date.now();
      
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: query,
        encoding_format: 'float',
      });

      const processingTime = Date.now() - startTime;
      const embedding = response.data[0].embedding;

      console.log(chalk.green(`├── ✅ Query embedding generated in ${processingTime}ms`));
      console.log(chalk.blue(`├── [Query Embedding] Vector (${embedding.length}-dim)`));
      console.log(chalk.gray(`├── 🎫 Tokens used: ${response.usage?.total_tokens || 'unknown'}`));

      return embedding;

    } catch (error) {
      console.error(chalk.red(`├── ❌ Query embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Query embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getModelInfo(): { model: string; dimensions: number } {
    const dimensions = this.model === 'text-embedding-3-large' ? 3072 : 1536;
    return { model: this.model, dimensions };
  }
}

export const createEmbedder = (apiKey: string, model?: string, batchSize?: number) => {
  return new DocumentEmbedder(apiKey, model, batchSize);
};
