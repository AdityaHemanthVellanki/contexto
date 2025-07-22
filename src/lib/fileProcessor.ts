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
      
      // We'll create our own test file and modify the process working directory temporarily
      const originalCwd = process.cwd();
      const testDirPath = path.join(tempDir, 'test', 'data');
      await fs.mkdir(testDirPath, { recursive: true });
      
      // Create the exact file that pdf-parse is looking for
      const minimalPdfPath = path.join(testDirPath, '05-versions-space.pdf');
      await fs.writeFile(minimalPdfPath, buffer);
      
      // Temporarily change working directory to use our test directory
      process.chdir(tempDir);
      
      // Process using direct approach
      try {
        const pdfParse = await import('pdf-parse');
        
        // First attempt - with direct options
        const options = {
          max: 0, // No page limit
          version: 'default',
          // Use the file we just created
          file: minimalPdfPath
        };
        
        console.log('Attempting PDF parsing with direct file reference');
        const result = await pdfParse.default(buffer, options);
        
        if (result && result.text) {
          console.log(`Successfully extracted ${result.text.length} characters from PDF`);
          return result.text;
        } else {
          console.warn('PDF parsed but no text content was extracted');
          return '';
        }
      } catch (primaryError) {
        console.error('Primary PDF parsing attempt failed:', primaryError);
        
        // Second attempt - fallback approach
        try {
          // Try parsing again with a simpler approach
          const pdfParse = await import('pdf-parse');
          const result = await pdfParse.default(buffer, { version: 'default' });
          
          if (result && result.text) {
            console.log(`Fallback PDF extraction succeeded with ${result.text.length} characters`);
            return result.text;
          } else {
            return '';
          }
        } catch (fallbackError) {
          console.error('Fallback PDF parsing also failed:', fallbackError);
          throw new Error('Multiple PDF parsing methods failed');
        }
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
 * Process PPTX files using pptxgenjs and JSZip
 */
async function processPPTX(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Load the PPTX file as a zip archive
    const pptxZip = await zip.loadAsync(buffer);
    
    // PPTX files contain slide content in ppt/slides/slide*.xml files
    const slideFiles = Object.keys(pptxZip.files).filter(fileName => 
      fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml'));
    
    // Sort slides by number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''));
      const numB = parseInt(b.replace(/\D/g, ''));
      return numA - numB;
    });
    
    // Process each slide
    const slideContents = await Promise.all(slideFiles.map(async (slideFile, index) => {
      const slideContent = await pptxZip.files[slideFile].async('text');
      
      // Extract text content from slide XML
      // This is a simple regex-based extraction that gets text between <a:t> tags
      // A production implementation might use proper XML parsing
      const textMatches = slideContent.match(/<a:t>([^<]+)<\/a:t>/g) || [];
      const extractedText = textMatches
        .map(match => match.replace(/<a:t>|<\/a:t>/g, ''))
        .join(' ');
      
      return `Slide ${index + 1}: ${extractedText}`;
    }));
    
    // Also try to extract any notes from the presentation
    const noteFiles = Object.keys(pptxZip.files).filter(fileName => 
      fileName.startsWith('ppt/notesSlides/notesSlide') && fileName.endsWith('.xml'));
    
    const notesContents = await Promise.all(noteFiles.map(async (noteFile, index) => {
      const noteContent = await pptxZip.files[noteFile].async('text');
      
      // Extract notes text content
      const textMatches = noteContent.match(/<a:t>([^<]+)<\/a:t>/g) || [];
      const extractedText = textMatches
        .map(match => match.replace(/<a:t>|<\/a:t>/g, ''))
        .join(' ');
      
      if (extractedText.trim()) {
        return `Notes ${index + 1}: ${extractedText}`;
      }
      return '';
    }));
    
    // Combine slide content and notes
    const allContent = [...slideContents, ...notesContents.filter(note => note !== '')].join('\n\n');
    
    return allContent || 'No text content could be extracted from this PPTX file.';
  } catch (error) {
    console.error('PPTX processing error:', error);
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
 * Modified to work in both browser and Node.js environments
 */
async function processImage(buffer: Buffer): Promise<string> {
  try {
    // Check if we're in a Node.js environment
    const isNode = typeof window === 'undefined';
    console.log(`Processing image in ${isNode ? 'Node.js' : 'browser'} environment`);
    
    // Import Tesseract with environment-specific configuration
    const Tesseract = await import('tesseract.js');
    
    // For Node.js environment, use a simpler configuration without browser-specific features
    if (isNode) {
      // Use a safer approach for Node.js that doesn't rely on browser APIs
      console.log('Using Node.js compatible OCR approach');
      // Use the standard recognize function with minimal options
      const result = await Tesseract.default.recognize(buffer, 'eng', {
        logger: (m: unknown) => console.log('Tesseract progress:', m)
      });
      return result.data.text;
    } else {
      // Browser environment can use the standard recognize function
      const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
      return text;
    }
  } catch (error) {
    console.error('OCR processing error:', error);
    
    // Fall back to a basic extraction approach
    try {
      console.log('OCR failed, using basic extraction fallback...');
      // Return a placeholder message when OCR fails completely
      return '[Image content could not be extracted. Please try a different file format or manually transcribe the image.]';
    } catch (fallbackError) {
      console.error('Fallback extraction also failed:', fallbackError);
      throw new Error(`Image OCR failed: ${error instanceof Error ? (error as Error).message : 'Unknown error'}`);
    }
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
    const { promisify } = require('util');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const ffmpeg = require('fluent-ffmpeg');

    // Create temporary files for video and extracted audio
    const tempDir = os.tmpdir();
    const randomId = Math.random().toString(36).substring(2, 15);
    const videoPath = path.join(tempDir, `video-${randomId}.mp4`);
    const audioPath = path.join(tempDir, `audio-${randomId}.mp3`);
    
    // Write video buffer to temporary file
    await promisify(fs.writeFile)(videoPath, buffer);
    
    // Extract audio from video using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions('-vn') // Disable video
        .audioCodec('libmp3lame') // Use MP3 codec
        .audioBitrate('128k') // Set bitrate
        .format('mp3') // Output format
        .on('error', (err: Error) => reject(err))
        .on('end', () => resolve(true))
        .save(audioPath);
    });
    
    // Read the extracted audio file
    const audioBuffer = await promisify(fs.readFile)(audioPath);
    
    // Process the audio with our existing audio processor
    const transcription = await processAudio(audioBuffer, 'audio/mp3');
    
    // Clean up temporary files
    try {
      await promisify(fs.unlink)(videoPath);
      await promisify(fs.unlink)(audioPath);
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
    
    return transcription || 'No speech content could be extracted from this video file.';
  } catch (error) {
    console.error('Video processing error:', error);
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
