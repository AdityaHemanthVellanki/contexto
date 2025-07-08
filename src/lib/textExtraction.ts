import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

const readFileAsync = promisify(fs.readFile);

/**
 * Extract text from various file types
 * @param filePath Path to the file
 * @param fileType MIME type of the file
 * @returns Extracted text content
 */
export async function extractText(filePath: string, fileType: string): Promise<string> {
  try {
    switch (fileType) {
      case 'text/plain':
      case 'text/csv':
      case 'text/markdown':
        // For text-based formats, just read the file
        const textContent = await readFileAsync(filePath, 'utf8');
        return textContent;
        
      case 'application/json':
        // For JSON files, read and handle potential structure
        const jsonContent = await readFileAsync(filePath, 'utf8');
        try {
          const jsonParsed = JSON.parse(jsonContent);
          // Convert the JSON to a formatted string for processing
          return typeof jsonParsed === 'string' 
            ? jsonParsed 
            : JSON.stringify(jsonParsed, null, 2);
        } catch (e) {
          // If JSON parsing fails, treat as plain text
          return jsonContent;
        }
        
      case 'application/pdf':
        // For PDF files, extract text content
        const pdfBytes = await readFileAsync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Simple text extraction (in production, use a more robust PDF text extractor)
        const numPages = pdfDoc.getPageCount();
        let pdfText = '';
        
        // Simple placeholder for PDF text extraction
        // Note: In production, integrate a proper PDF text extraction library like pdf.js
        pdfText = `PDF with ${numPages} pages. Full text extraction requires additional libraries.`;
        
        return pdfText;
        
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : String(error)}`);
  }
}
