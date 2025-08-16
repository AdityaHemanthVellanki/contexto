import * as mammoth from 'mammoth';
// Import the core module to avoid index.js debug harness that reads a test PDF
// @ts-ignore - CJS interop, types are not provided
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
// @ts-ignore - Tesseract.js has incomplete type definitions
import * as Tesseract from 'tesseract.js';

/**
 * Text chunking configuration
 */
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
}

/**
 * Extract text from different file types
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  try {
    switch (mimeType) {
      case 'text/plain':
      case 'text/csv':
      case 'text/markdown':
        return buffer.toString('utf-8');
      
      case 'application/json':
        const jsonData = JSON.parse(buffer.toString('utf-8'));
        return JSON.stringify(jsonData, null, 2);
      
      case 'application/pdf':
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer });
        return docxResult.value;
      
      case 'image/jpeg':
      case 'image/jpg':
      case 'image/png':
        // @ts-ignore - Tesseract.js has incomplete type definitions
        const ocrResult = await Tesseract.recognize(buffer, 'eng');
        return ocrResult.data.text;
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error(`Failed to extract text from ${fileName}`);
  }
}

/**
 * Process file and return chunks with metadata
 */
export async function processFileToChunks(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  fileId: string
): Promise<Array<{
  id: string;
  text: string;
  metadata: {
    fileId: string;
    fileName: string;
    chunkIndex: number;
    totalChunks: number;
  };
}>> {
  try {
    // Extract text from file
    const text = await extractTextFromFile(buffer, mimeType, fileName);
    
    // Split into chunks
    const chunks = chunkText(text);
    
    // Create chunk objects with metadata
    return chunks.map((chunk, index) => ({
      id: `${fileId}-chunk-${index}`,
      text: chunk,
      metadata: {
        fileId,
        fileName,
        chunkIndex: index,
        totalChunks: chunks.length
      }
    }));
  } catch (error) {
    console.error('File processing error:', error);
    throw new Error(`Failed to process file: ${fileName}`);
  }
}

/**
 * Process description into chunks for MCP creation without files
 */
export async function processDescriptionToChunks(
  description: string,
  pipelineId: string
): Promise<Array<{
  id: string;
  text: string;
  metadata: {
    pipelineId: string;
    chunkIndex: number;
    totalChunks: number;
    source: 'description';
  };
}>> {
  const cleanedText = cleanText(description);
  const chunks = chunkText(cleanedText);
  
  return chunks.map((chunk, index) => ({
    id: `${pipelineId}-desc-${index}`,
    text: chunk,
    metadata: {
      pipelineId,
      chunkIndex: index,
      totalChunks: chunks.length,
      source: 'description' as const
    }
  }));
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Extract text from multiple files using their download URLs
 * @param urls Array of file download URLs with metadata
 * @returns Promise resolving to array of extracted text content
 */
export async function extractTextFromFiles(
  urls: Array<{ url: string; fileName: string; fileId: string; contentType: string }>
): Promise<Array<{ text: string; fileName: string; fileId: string }>> {
  const results = [];
  
  for (const file of urls) {
    try {
      // Download the file
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${file.fileName}`);
      }
      
      // Convert to buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Extract text
      const text = await extractTextFromFile(buffer, file.contentType, file.fileName);
      
      results.push({
        text,
        fileName: file.fileName,
        fileId: file.fileId
      });
    } catch (error) {
      console.error(`Error processing file ${file.fileName}:`, error);
      // Include the file in results but with error message as text
      results.push({
        text: `Error extracting text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fileName: file.fileName,
        fileId: file.fileId
      });
    }
  }
  
  return results;
}
