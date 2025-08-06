import { DocumentChunker } from '../src/lib/services/chunker';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * Test the DocumentChunker component
 * This test can run without external API dependencies
 */
async function testChunker() {
  console.log(chalk.magenta.bold('🧪 CHUNKER COMPONENT TEST - Starting'));
  
  try {
    // Load test document
    const documentPath = path.join(__dirname, 'sample_company_handbook.txt');
    const documentText = fs.readFileSync(documentPath, 'utf-8');
    console.log(chalk.blue(`├── Loaded test document: ${documentText.length} characters`));
    
    // Create test document metadata
    const docId = 'test-doc-123';
    const docName = 'Sample Company Handbook';
    
    // Test with different chunk sizes and overlaps
    const testCases = [
      { size: 800, overlap: 150, name: 'Default Settings' },
      { size: 500, overlap: 50, name: 'Small Chunks' },
      { size: 1200, overlap: 200, name: 'Large Chunks' }
    ];
    
    for (const testCase of testCases) {
      console.log(chalk.yellow(`\n├── Test Case: ${testCase.name}`));
      console.log(chalk.blue(`├── Chunk Size: ${testCase.size}, Overlap: ${testCase.overlap}`));
      
      // Initialize chunker with test parameters
      const chunker = new DocumentChunker(testCase.size, testCase.overlap);
      
      // Process document
      console.time('chunking');
      const result = await chunker.chunkDocument(documentText, docId, docName);
      console.timeEnd('chunking');
      
      // Validate results
      console.log(chalk.green(`├── ✅ Chunking complete: ${result.totalChunks} chunks created`));
      console.log(chalk.blue(`├── Total Characters: ${result.totalCharacters}`));
      console.log(chalk.blue(`├── Average Chunk Size: ${Math.round(result.averageChunkSize)} characters`));
      console.log(chalk.blue(`├── Processing Time: ${result.processingTime}ms`));
      
      // Verify chunk properties
      let validChunks = 0;
      let invalidChunks = 0;
      
      for (let i = 0; i < result.chunks.length; i++) {
        const chunk = result.chunks[i];
        
        // Check chunk size (should be approximately the target size)
        const isValidSize = chunk.text.length <= testCase.size * 1.5; // Allow some flexibility
        
        // Check chunk metadata
        const hasValidMetadata = 
          chunk.metadata.docId === docId &&
          chunk.metadata.docName === docName &&
          chunk.metadata.chunkIndex === i;
        
        if (isValidSize && hasValidMetadata) {
          validChunks++;
        } else {
          invalidChunks++;
          console.log(chalk.yellow(`├── ⚠️ Chunk ${i} validation issues:`));
          if (!isValidSize) {
            console.log(chalk.yellow(`├── ⚠️ Size: ${chunk.text.length} (exceeds target: ${testCase.size})`));
          }
          if (!hasValidMetadata) {
            console.log(chalk.yellow(`├── ⚠️ Invalid metadata`));
          }
        }
      }
      
      console.log(chalk.blue(`├── Valid Chunks: ${validChunks}/${result.totalChunks}`));
      if (invalidChunks > 0) {
        console.log(chalk.yellow(`├── ⚠️ Invalid Chunks: ${invalidChunks}/${result.totalChunks}`));
      }
      
      // Verify chunk overlaps
      if (result.chunks.length > 1) {
        let validOverlaps = 0;
        let invalidOverlaps = 0;
        
        for (let i = 1; i < result.chunks.length; i++) {
          const prevChunk = result.chunks[i-1].text;
          const currentChunk = result.chunks[i].text;
          
          // Check if there's text overlap between consecutive chunks
          const hasOverlap = checkTextOverlap(prevChunk, currentChunk);
          
          if (hasOverlap) {
            validOverlaps++;
          } else {
            invalidOverlaps++;
            console.log(chalk.yellow(`├── ⚠️ No overlap detected between chunks ${i-1} and ${i}`));
          }
        }
        
        console.log(chalk.blue(`├── Chunks with proper overlap: ${validOverlaps}/${result.chunks.length-1}`));
        if (invalidOverlaps > 0) {
          console.log(chalk.yellow(`├── ⚠️ Chunks without proper overlap: ${invalidOverlaps}/${result.chunks.length-1}`));
        }
      }
    }
    
    console.log(chalk.magenta.bold('\n🎉 CHUNKER COMPONENT TEST - Complete'));
    return { success: true };
    
  } catch (error) {
    console.error(chalk.red(`❌ TEST FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`));
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(error.stack));
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check if there's text overlap between two chunks
 */
function checkTextOverlap(chunk1: string, chunk2: string): boolean {
  // Get the last 50 characters of the first chunk
  const tailLength = Math.min(50, chunk1.length);
  const tail = chunk1.substring(chunk1.length - tailLength);
  
  // Get the first 50 characters of the second chunk
  const headLength = Math.min(50, chunk2.length);
  const head = chunk2.substring(0, headLength);
  
  // Check for any overlap
  for (let i = 1; i <= Math.min(tailLength, headLength); i++) {
    const tailPiece = tail.substring(tail.length - i);
    const headPiece = head.substring(0, i);
    
    if (tailPiece === headPiece) {
      return true;
    }
  }
  
  return false;
}

// Run the test
if (require.main === module) {
  testChunker()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { testChunker };
