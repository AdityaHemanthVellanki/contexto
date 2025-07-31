import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromImage } from './image-ocr';

// Supported file types - common document and image types
export const SupportedFileTypes = {
  // Text files
  TEXT: 'text/plain',
  CSV: 'text/csv',
  JSON: 'application/json',
  MARKDOWN: 'text/markdown',
  
  // Documents
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  
  // Images (with OCR support)
  PNG: 'image/png',
  JPEG: 'image/jpeg'
} as const;

// Extensions for supported file types
export const SupportedFileExtensions = {
  TEXT: '.txt',
  CSV: '.csv',
  JSON: '.json',
  MARKDOWN: '.md',
  PDF: '.pdf',
  DOCX: '.docx',
  PNG: '.png',
  JPEG: '.jpg',
  JPG: '.jpeg'
} as const;

export type FileType = typeof SupportedFileTypes[keyof typeof SupportedFileTypes];

/**
 * Process file buffer and extract text content based on file type
 */
export async function processFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  console.log(`Processing file: ${fileName} (${mimeType})`);
  
  try {
    switch (mimeType) {
      // Text files
      case SupportedFileTypes.TEXT:
      case SupportedFileTypes.CSV:
      case SupportedFileTypes.MARKDOWN:
        return buffer.toString('utf-8');
      
      case SupportedFileTypes.JSON:
        const jsonContent = buffer.toString('utf-8');
        // Validate JSON and return formatted text
        const parsed = JSON.parse(jsonContent);
        return JSON.stringify(parsed, null, 2);
      
      // PDF files
      case SupportedFileTypes.PDF:
        return await processPDF(buffer);
      
      // Microsoft Office documents
      case SupportedFileTypes.DOCX:
        return await processDOCX(buffer);
      
      // Image files with OCR
      case SupportedFileTypes.PNG:
      case SupportedFileTypes.JPEG:
        return await extractTextFromImage(buffer, mimeType, fileName);
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error(`Error processing ${mimeType} file:`, error);
    throw new Error(`Failed to process ${mimeType} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process PDF files using pdf-parse with custom handling to avoid test file references
 */
async function processPDF(buffer: Buffer): Promise<string> {
  // Track the original working directory so we can restore it later
  let originalCwd = process.cwd();
  let tempDir = '';
  
  try {
    console.log(`Processing PDF with buffer size: ${buffer.byteLength} bytes`);
    
    // Create a temporary directory to isolate pdf-parse from its default test paths
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const crypto = await import('crypto');
    
    // Create a unique temporary directory with randomness to avoid collisions
    const randomId = crypto.randomBytes(8).toString('hex');
    tempDir = path.join(os.tmpdir(), `pdf-extract-${randomId}-${Date.now()}`);
    
    try {
      // Ensure the directory exists
      await fs.mkdir(tempDir, { recursive: true });
      console.log(`Created temporary directory for PDF processing: ${tempDir}`);
      
      // Process PDF directly without changing working directory
      const originalCwd = process.cwd();
      
      // Process using direct approach
      try {
        const pdfParse = await import('pdf-parse');
        
        // Process PDF with basic options
        const options = {
          max: 0, // No page limit
          version: 'default'
        };
        
        console.log('Parsing PDF with direct file reference');
        const result = await pdfParse.default(buffer, options);
        
        if (result && result.text) {
          console.log(`Successfully extracted ${result.text.length} characters from PDF`);
          return result.text;
        } else {
          // Hard failure if no text is extracted
          throw new Error('PDF parsed but no text content was extracted');
        }
      } catch (primaryError) {
        console.error('PDF parsing failed:', primaryError);
        throw primaryError;
      }
    } finally {
      // Restore original working directory if it was changed
      if (originalCwd) {
        process.chdir(originalCwd);
        console.log('Restored original working directory');
      }
      
      // Always clean up the temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary directory: ${tempDir}`);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temporary directory: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('PDF processing failed completely:', error);
    throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process DOCX files using mammoth
 */
async function processDOCX(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`DOCX processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot !== -1 ? fileName.slice(lastDot) : '';
}

/**
 * Validate if file type is supported
 */
export function isSupportedFileType(mimeType: string): boolean {
  return Object.values(SupportedFileTypes).includes(mimeType as FileType);
}

/**
 * Get human-readable file type description
 */
export function getFileTypeDescription(mimeType: string): string {
  const descriptions: Record<string, string> = {
    [SupportedFileTypes.TEXT]: 'Plain Text',
    [SupportedFileTypes.CSV]: 'CSV Spreadsheet',
    [SupportedFileTypes.JSON]: 'JSON Data',
    [SupportedFileTypes.MARKDOWN]: 'Markdown Document',
    [SupportedFileTypes.PDF]: 'PDF Document',
    [SupportedFileTypes.DOCX]: 'Word Document',
    [SupportedFileTypes.PNG]: 'PNG Image',
    [SupportedFileTypes.JPEG]: 'JPEG Image'
  };
  
  return descriptions[mimeType] || 'Unsupported File Type';
}
