/**
 * Image OCR Processing Module
 * 
 * This module provides functionality to extract text from images using Tesseract.js OCR.
 * Supports PNG and JPEG image formats.
 */

import * as Tesseract from 'tesseract.js';
import path from 'path';

/**
 * Extract text from an image using OCR
 * 
 * @param buffer - The image file buffer
 * @param mimeType - The MIME type of the image (image/png or image/jpeg)
 * @param filename - The original filename for logging purposes
 * @returns Extracted text from the image
 */
export async function extractTextFromImage(
  buffer: Buffer, 
  mimeType: string, 
  filename: string
): Promise<string> {
  try {
    console.log(`Starting OCR processing for ${filename} (${mimeType}), size: ${buffer.byteLength} bytes`);
    
    // Create a worker with proper paths for Node.js environment
    // @ts-ignore - Tesseract.js types are not fully compatible with TypeScript
    const worker = await Tesseract.createWorker({
      logger: (m: any) => console.log(`Tesseract progress (${filename}):`, m)
    });
    
    // Initialize the worker with English language
    console.log(`Initializing Tesseract worker for ${filename}`);
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Recognize text from the image buffer
    console.log(`Starting text recognition for ${filename}`);
    const { data: { text } } = await worker.recognize(buffer);
    
    // Clean up resources
    await worker.terminate();
    
    // Log results
    if (text && text.trim()) {
      console.log(`OCR successful for ${filename}. Extracted ${text.length} characters.`);
      return text;
    } else {
      console.warn(`OCR completed for ${filename} but no text was extracted.`);
      return '';
    }
  } catch (err) {
    console.error(`OCR processing failed for ${filename}:`, err);
    throw new Error(`Failed OCR extraction for ${mimeType}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
