import { encode } from 'gpt-tokenizer';

/**
 * Chunker node - Split text into overlapping chunks
 * 
 * @param text The full text to split into chunks
 * @param size The target chunk size in tokens (default: 500)
 * @param overlap The overlap between consecutive chunks in tokens (default: 50)
 * @returns Array of text chunks
 */
export async function runChunker(text: string, size = 500, overlap = 50): Promise<string[]> {
  if (!text) {
    throw new Error('Chunker failed: No text provided');
  }

  try {
    // For large texts, first split into more manageable segments
    // 1 MiB = 1,048,576 bytes
    if (Buffer.byteLength(text, 'utf-8') > 1048576) {
      return chunkLargeText(text, size, overlap);
    }

    // For smaller texts, use the sliding window approach directly
    return createSlidingWindowChunks(text, size, overlap);
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Chunker failed: ${e.message}`);
    }
    throw new Error('Chunker failed: Unknown error');
  }
}

/**
 * Split large text into chunks by paragraphs first, then apply sliding window
 * 
 * @param text The large text to chunk
 * @param size The target chunk size in tokens
 * @param overlap The overlap between chunks in tokens
 * @returns Array of text chunks
 */
function chunkLargeText(text: string, size: number, overlap: number): string[] {
  // First split by paragraphs (double newlines)
  const paragraphs = text.split(/\n\s*\n/);
  
  // Group paragraphs into larger segments that don't exceed size*2 tokens
  const segments: string[] = [];
  let currentSegment = '';
  let currentTokenCount = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = encode(paragraph).length;
    
    // If adding this paragraph would exceed double the chunk size,
    // save current segment and start a new one
    if (currentTokenCount + paragraphTokens > size * 2) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = paragraph;
      currentTokenCount = paragraphTokens;
    } else {
      // Otherwise add to current segment
      currentSegment += currentSegment ? '\n\n' + paragraph : paragraph;
      currentTokenCount += paragraphTokens;
    }
  }
  
  // Add the last segment if it exists
  if (currentSegment) {
    segments.push(currentSegment);
  }
  
  // Now apply sliding window to each segment
  const allChunks: string[] = [];
  for (const segment of segments) {
    const segmentChunks = createSlidingWindowChunks(segment, size, overlap);
    allChunks.push(...segmentChunks);
  }
  
  return allChunks;
}

/**
 * Create sliding window chunks of text based on token count
 * 
 * @param text Text to split into chunks
 * @param size Target size in tokens
 * @param overlap Overlap in tokens
 * @returns Array of text chunks
 */
function createSlidingWindowChunks(text: string, size: number, overlap: number): string[] {
  // Tokenize the text
  const tokens = encode(text);
  
  if (tokens.length <= size) {
    // Text is smaller than the chunk size, return as a single chunk
    return [text];
  }
  
  const chunks: string[] = [];
  let startIdx = 0;
  
  while (startIdx < tokens.length) {
    // Calculate end index for this chunk
    const endIdx = Math.min(startIdx + size, tokens.length);
    
    // Decode tokens back to text
    const chunkTokens = tokens.slice(startIdx, endIdx);
    const chunkText = decodeTokens(chunkTokens, text);
    
    chunks.push(chunkText);
    
    // Move start index for next chunk, accounting for overlap
    startIdx += size - overlap;
    
    // If we can't move forward anymore, break
    if (startIdx + overlap >= tokens.length) {
      break;
    }
  }
  
  return chunks;
}

/**
 * Decode tokens back to text, trying to preserve the original text
 * This is a simplified approach that tries to map token indices to character positions
 * 
 * @param tokens Array of tokens to decode
 * @param originalText The original text (for reference)
 * @returns Decoded text
 */
function decodeTokens(tokens: number[], originalText: string): string {
  // This is a simplified implementation
  // In a production environment, you would use a more sophisticated approach
  
  // Simple approach: re-encode the original text, find the positions
  const allTokens = encode(originalText);
  const startTokenIdx = tokens[0];
  const endTokenIdx = tokens[tokens.length - 1];
  
  // Find the start token in the original text's token array
  const startIdx = allTokens.indexOf(startTokenIdx);
  
  if (startIdx === -1) {
    // Hard failure if token not found
    throw new Error('Failed to locate start token in original text');
  }
  
  // Find end position
  const endIdx = allTokens.lastIndexOf(endTokenIdx, startIdx + tokens.length);
  
  // Extract the corresponding text
  if (endIdx !== -1 && endIdx >= startIdx) {
    const tokenSubset = allTokens.slice(startIdx, endIdx + 1);
    // Now map these tokens back to the original text
    return tokenSubset.map(t => String.fromCharCode(t)).join('');
  }
  
  // Hard failure if end token not found
  throw new Error('Failed to locate end token in original text');
}
