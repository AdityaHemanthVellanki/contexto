import chalk from 'chalk';

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    chunkIndex: number;
    docId: string;
    docName: string;
    startChar: number;
    endChar: number;
    chunkLength: number;
    overlap: number;
    timestamp: string;
  };
}

export interface ChunkResult {
  chunks: DocumentChunk[];
  totalChunks: number;
  totalCharacters: number;
  averageChunkSize: number;
  processingTime: number;
}

export class DocumentChunker {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize: number = 800, chunkOverlap: number = 150) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;

    console.log(chalk.cyan(`├── 🔧 Chunker initialized (size: ${chunkSize}, overlap: ${chunkOverlap})`));
  }

  async chunkDocument(text: string, docId: string, docName: string): Promise<ChunkResult> {
    console.log(chalk.yellow(`├── 📄 Chunking document: ${docName} (${text.length} characters)`));
    
    const startTime = Date.now();
    
    try {
      const textChunks = this.splitText(text);
      
      const chunks: DocumentChunk[] = textChunks.map((chunk: string, index: number) => {
        const startChar = this.calculateStartChar(index);
        const endChar = startChar + chunk.length;
        
        console.log(chalk.blue(`├── [Chunk ${index + 1}] ${chunk.length} chars (${startChar}-${endChar})`));
        
        return {
          id: `${docId}_chunk_${index}`,
          text: chunk,
          metadata: {
            chunkIndex: index,
            docId,
            docName,
            startChar,
            endChar,
            chunkLength: chunk.length,
            overlap: index > 0 ? this.chunkOverlap : 0,
            timestamp: new Date().toISOString(),
          },
        };
      });

      const processingTime = Date.now() - startTime;
      const totalCharacters = chunks.reduce((sum: number, chunk: DocumentChunk) => sum + chunk.text.length, 0);
      const averageChunkSize = totalCharacters / chunks.length;

      console.log(chalk.green(`├── ✅ Chunking complete: ${chunks.length} chunks in ${processingTime}ms`));
      console.log(chalk.green(`├── [Stats] Avg size: ${Math.round(averageChunkSize)} chars, Total: ${totalCharacters} chars`));

      return {
        chunks,
        totalChunks: chunks.length,
        totalCharacters,
        averageChunkSize,
        processingTime,
      };

    } catch (error) {
      console.error(chalk.red(`├── ❌ Chunking failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Document chunking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private splitText(text: string): string[] {
    const chunks: string[] = [];
    const separators = ['\n\n', '\n', '. ', ' '];
    
    let currentText = text;
    let position = 0;
    
    while (position < text.length) {
      let chunkEnd = Math.min(position + this.chunkSize, text.length);
      
      // Try to find a good breaking point
      if (chunkEnd < text.length) {
        let bestBreak = chunkEnd;
        
        for (const separator of separators) {
          const lastSeparator = text.lastIndexOf(separator, chunkEnd);
          if (lastSeparator > position) {
            bestBreak = lastSeparator + separator.length;
            break;
          }
        }
        
        chunkEnd = bestBreak;
      }
      
      const chunk = text.slice(position, chunkEnd).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      
      // Move position forward, accounting for overlap
      position = Math.max(position + 1, chunkEnd - this.chunkOverlap);
    }
    
    return chunks;
  }

  private calculateStartChar(chunkIndex: number): number {
    if (chunkIndex === 0) return 0;
    
    // Simple approximation - in production you'd want more sophisticated tracking
    const previousChunksLength = chunkIndex * (this.chunkSize - this.chunkOverlap);
    return Math.max(0, previousChunksLength);
  }

  private getChunkingStats(): { chunkSize: number; chunkOverlap: number } {
    return {
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    };
  }
}

export const createChunker = (chunkSize?: number, chunkOverlap?: number) => {
  return new DocumentChunker(chunkSize, chunkOverlap);
};
