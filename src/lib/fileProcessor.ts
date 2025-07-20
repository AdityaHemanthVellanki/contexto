import { z } from 'zod';

// Supported file types
export const SupportedFileTypes = {
  // Text files
  TEXT: 'text/plain',
  CSV: 'text/csv',
  JSON: 'application/json',
  MARKDOWN: 'text/markdown',
  HTML: 'text/html',
  
  // Documents
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  
  // Images
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  
  // Audio
  MP3: 'audio/mpeg',
  WAV: 'audio/wav',
  
  // Video
  MP4: 'video/mp4',
  MOV: 'video/quicktime'
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
      case SupportedFileTypes.HTML:
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
      
      case SupportedFileTypes.PPTX:
        return await processPPTX(buffer);
      
      case SupportedFileTypes.XLSX:
        return await processXLSX(buffer);
      
      // Images (OCR)
      case SupportedFileTypes.PNG:
      case SupportedFileTypes.JPEG:
      case SupportedFileTypes.JPG:
        return await processImage(buffer);
      
      // Audio files (Speech-to-text)
      case SupportedFileTypes.MP3:
      case SupportedFileTypes.WAV:
        return await processAudio(buffer, mimeType);
      
      // Video files (Extract audio then speech-to-text)
      case SupportedFileTypes.MP4:
      case SupportedFileTypes.MOV:
        return await processVideo(buffer, mimeType);
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error(`Error processing ${mimeType} file:`, error);
    throw new Error(`Failed to process ${mimeType} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process PDF files using pdf-parse
 */
async function processPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);
    return data.text;
  } catch (error) {
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
 * Process PPTX files using pptx-parser
 */
async function processPPTX(buffer: Buffer): Promise<string> {
  try {
    // For now, return a placeholder - PPTX parsing is complex
    // In production, you'd use a library like 'pptx-parser' or similar
    return 'PPTX content extraction not yet implemented. Please convert to PDF or text format.';
  } catch (error) {
    throw new Error(`PPTX processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process XLSX files using SheetJS
 */
async function processXLSX(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      text += `Sheet: ${sheetName}\n${csv}\n\n`;
    });
    
    return text.trim();
  } catch (error) {
    throw new Error(`XLSX processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process images using Tesseract OCR
 */
async function processImage(buffer: Buffer): Promise<string> {
  try {
    const Tesseract = await import('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
      logger: (m: unknown) => console.log(m)
    });
    return text;
  } catch (error) {
    throw new Error(`Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process audio files using OpenAI Whisper API
 */
async function processAudio(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
      throw new Error('Azure OpenAI configuration not found for audio processing');
    }

    const { OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/whisper-1`,
      defaultQuery: { 'api-version': '2024-02-01' },
      defaultHeaders: {
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
    });

    // Create a temporary file-like object for the API
    const file = new File([buffer], 'audio', { type: mimeType });
    
    const transcription = await client.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    return transcription.text;
  } catch (error) {
    throw new Error(`Audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process video files by extracting audio and then using speech-to-text
 */
async function processVideo(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    // For now, return a placeholder - video processing requires ffmpeg
    // In production, you'd use ffmpeg to extract audio, then process with Whisper
    return 'Video processing not yet implemented. Please extract audio manually and upload as MP3/WAV.';
  } catch (error) {
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    [SupportedFileTypes.HTML]: 'HTML Document',
    [SupportedFileTypes.PDF]: 'PDF Document',
    [SupportedFileTypes.DOCX]: 'Word Document',
    [SupportedFileTypes.PPTX]: 'PowerPoint Presentation',
    [SupportedFileTypes.XLSX]: 'Excel Spreadsheet',
    [SupportedFileTypes.PNG]: 'PNG Image',
    [SupportedFileTypes.JPEG]: 'JPEG Image',
    [SupportedFileTypes.JPG]: 'JPEG Image',
    [SupportedFileTypes.MP3]: 'MP3 Audio',
    [SupportedFileTypes.WAV]: 'WAV Audio',
    [SupportedFileTypes.MP4]: 'MP4 Video',
    [SupportedFileTypes.MOV]: 'QuickTime Video'
  };
  
  return descriptions[mimeType] || 'Unknown File Type';
}
