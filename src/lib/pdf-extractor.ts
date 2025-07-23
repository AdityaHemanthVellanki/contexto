/**
 * PDF text extraction utilities that work in Node.js environment
 * PDF text extractor
 * Provides direct text extraction from PDF files with no fallbacks
 * for production-grade reliability
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
// Use require for pdf-parse to avoid type issues
// Create a custom version to avoid test file dependencies
const pdfParse = (buffer: Buffer) => {
  try {
    // Get the core module without running tests
    const pdf = require('pdf-parse/lib/pdf-parse.js');
    
    // Set options to avoid looking for test files
    const options = {
      // Avoid using any external files
      useSystemFonts: false,
      // Max pages to process (0 = all pages)
      max: 0
    };
    
    return pdf(buffer, options);
  } catch (error) {
    console.error('Error initializing pdf-parse:', error);
    throw new Error(`PDF parsing initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

interface PdfExtractor {
  extractText: (buffer: ArrayBuffer) => Promise<string>;
}

/**
 * Creates a PDF extractor that works in Node.js environment
 * Falls back to simpler methods if more complex ones fail
 * Main entry point - attempts multiple text extraction methods
 * 
 * @param buffer PDF file as ArrayBuffer
 * @returns Extracted text
 */
export async function extractText(buffer: ArrayBuffer): Promise<string> {
  // Determine if we're in a browser or Node.js environment
  const isNode = typeof window === 'undefined';
  
  if (isNode) {
    // Track extraction attempts for better error reporting
    const errors: Error[] = [];
    
    // No fallbacks - use pdf-parse directly and throw clear errors if it fails
    console.log('Using pdf-parse for Node.js PDF extraction');
    // Convert ArrayBuffer to Buffer for pdf-parse
    const nodeBuffer = Buffer.from(buffer);
    
    // Verify buffer is valid
    if (nodeBuffer.length === 0) {
      throw new Error('Empty PDF buffer provided');
    }
    
    try {
      const data = await pdfParse(nodeBuffer);
      const extractedText = data.text || '';
      
      // Check if we got any text
      if (extractedText.trim().length > 0) {
        return extractedText;
      } else {
        throw new Error('PDF parse returned empty text');
      }
    } catch (pdfParseError) {
      // Log the error and provide a clear error message
      console.error('PDF extraction failed:', pdfParseError);
      throw new Error(`PDF extraction failed: ${pdfParseError instanceof Error ? pdfParseError.message : 'Unknown error'}`);
    }
  } else {
    // Browser environment - use PDF.js
    try {
      return await extractWithPdfJs(buffer);
    } catch (pdfJsError) {
      console.error('PDF.js extraction error:', pdfJsError);
      throw new Error(`Browser PDF extraction failed: ${pdfJsError instanceof Error ? pdfJsError.message : 'Unknown error'}`);
    }
  }
}

/**
 * Attempt to extract text using PDF.js if available
 * Only used in browser environments
 */
async function extractWithPdfJs(buffer: ArrayBuffer): Promise<string> {
  // This function should only be called in browser environments
  if (typeof window === 'undefined') {
    console.warn('PDF.js extraction attempted in Node.js environment');
    throw new Error('PDF.js extraction not supported in Node.js environment');
  }
  
  // This code will only run in browser environments
  const pdfjs = await import('pdfjs-dist');
  
  // Configure for browser
  const pdfjsVersion = pdfjs.version || '3.4.120';
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;
  
  // Use the browser version
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
  });
  
  // Set timeout to prevent hanging
  const timeoutPromise = new Promise<null>((_, reject) => {
    setTimeout(() => reject(new Error('PDF processing timeout')), 30000);
  });
  
  // Race against timeout
  const pdf = await Promise.race([
    loadingTask.promise,
    timeoutPromise
  ]) as any;
    
  if (!pdf) {
    throw new Error('Failed to load PDF');
  }
  
  // Extract text from all pages and combine
  let text = '';
  const numPages = pdf.numPages;
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    
    text += pageText + '\n';
  }
  
  return text.trim();
}

/**
 * Simple text extraction method that doesn't rely on complex libraries
 * Extract text using a basic command-line approach
 * Uses system tools that should be available on most Unix-like systems
 * 
 * @param buffer PDF file as ArrayBuffer
 * @returns Extracted text
 */
async function extractBasicMethod(buffer: ArrayBuffer): Promise<string> {
  // Generate a unique temporary directory to avoid conflicts
  const uniqueId = uuidv4().slice(0, 8);
  const tempDir = join(tmpdir(), `pdf-extract-${uniqueId}`);
  let pdfPath = join(tempDir, `document-${uniqueId}.pdf`);
  const bufferObj = Buffer.from(buffer);
  
  // Track extraction results for each method
  let extractedText = '';
  const errors: string[] = [];
  
  try {
    // Create directory if it doesn't exist
    try {
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }
    } catch (mkdirError) {
      console.warn('Failed to create temp directory:', mkdirError);
      // Fall back to using just the filename in the system temp dir
      pdfPath = join(tmpdir(), `document-${uniqueId}.pdf`);
    }
    
    // Write the PDF to disk
    try {
      writeFileSync(pdfPath, bufferObj);
    } catch (writeError) {
      console.error('Failed to write PDF to temp file:', writeError);
      throw new Error(`Could not create temporary PDF file: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`);
    }
    
    // Method 1: Extract text using the 'strings' command-line utility
    try {
      const stdout = execSync(`strings "${pdfPath}"`, { 
        encoding: 'utf-8',
        timeout: 10000 // 10 second timeout
      });
      
      if (stdout && stdout.trim().length > 0) {
        extractedText = stdout.trim();
        return extractedText; // Return immediately if successful
      } else {
        errors.push('strings command returned empty output');
      }
    } catch (stringsError) {
      errors.push(`strings command failed: ${stringsError instanceof Error ? stringsError.message : 'Unknown error'}`);
    }
    
    // Method 2: Try pdftotext if available
    try {
      const pdfToTextOutput = execSync(`pdftotext "${pdfPath}" - | cat`, { 
        encoding: 'utf-8',
        timeout: 10000 // 10 second timeout
      });
      
      if (pdfToTextOutput && pdfToTextOutput.trim().length > 0) {
        extractedText = pdfToTextOutput.trim();
        return extractedText; // Return immediately if successful
      } else {
        errors.push('pdftotext command returned empty output');
      }
    } catch (pdfToTextError) {
      errors.push(`pdftotext command failed: ${pdfToTextError instanceof Error ? pdfToTextError.message : 'Unknown error'}`);
    }
    
    // Method 3: Try cat with grep to extract any text content
    try {
      const catGrepOutput = execSync(`cat "${pdfPath}" | grep -a "[A-Za-z]"`, { 
        encoding: 'utf-8',
        timeout: 5000 // 5 second timeout
      });
      
      if (catGrepOutput && catGrepOutput.trim().length > 0) {
        extractedText = catGrepOutput.trim();
        return extractedText; // Return immediately if successful
      } else {
        errors.push('cat/grep command returned empty output');
      }
    } catch (catError) {
      errors.push(`cat/grep command failed: ${catError instanceof Error ? catError.message : 'Unknown error'}`);
    }
    
    // If we got here, all methods failed
    if (errors.length > 0) {
      console.warn('All basic extraction methods failed:', errors.join('; '));
    }
    
    // Return a placeholder message if all methods failed
    return "[PDF content could not be extracted. The document has been stored but may require manual processing.]";
  } finally {
    // Clean up temp files
    try {
      if (existsSync(pdfPath)) {
        unlinkSync(pdfPath);
      }
      // Try to remove the temp directory if it exists
      if (existsSync(tempDir)) {
        try {
          // Remove directory if empty
          rmdirSync(tempDir);
        } catch (rmdirError) {
          // Silently fail directory cleanup
        }
      }
    } catch (cleanupError) {
      // Silently fail cleanup
      console.warn('Failed to clean up temporary files:', cleanupError);
    }
  }
}
