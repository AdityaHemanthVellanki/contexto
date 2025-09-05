import 'server-only';
import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';
import { PipelineLogger } from './utils/pipeline-logger';

export interface FileProcessingResult {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    characterCount: number;
    fileType: string;
    processingTime: number;
  };
}

export class FileProcessor {
  private logger: PipelineLogger;

  constructor(logger?: PipelineLogger) {
    this.logger = logger || new PipelineLogger('FILE_PROCESSOR');
  }

  /**
   * Process file buffer and extract text content
   */
  async processFile(fileBuffer: Buffer, fileName: string): Promise<FileProcessingResult> {
    const startTime = Date.now();
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    this.logger.stageHeader('FILE PROCESSING');
    this.logger.info(`Processing ${fileExtension?.toUpperCase()} file: ${fileName}`);
    this.logger.info(`File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    let text: string;
    let pageCount: number | undefined;

    try {
      switch (fileExtension) {
        case 'pdf':
          const result = await this.processPDF(fileBuffer);
          text = result.text;
          pageCount = result.pageCount;
          break;
        
        case 'docx':
          text = await this.processDOCX(fileBuffer);
          break;
        
        case 'html':
          text = await this.processHTML(fileBuffer);
          break;
        
        case 'txt':
        case 'md':
          text = await this.processPlainText(fileBuffer);
          break;
        
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      // Clean and normalize text
      text = this.cleanText(text);
      
      const processingTime = Date.now() - startTime;
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      const characterCount = text.length;

      const metadata = {
        pageCount,
        wordCount,
        characterCount,
        fileType: fileExtension || 'unknown',
        processingTime
      };

      this.logger.stageComplete('File processing complete', {
        'Text Length': `${characterCount.toLocaleString()} characters`,
        'Word Count': `${wordCount.toLocaleString()} words`,
        'Pages': pageCount ? `${pageCount} pages` : 'N/A',
        'Processing Time': `${processingTime}ms`
      });

      return { text, metadata };

    } catch (error) {
      this.logger.stageError('File processing failed', error as Error);
      throw error;
    }
  }

  /**
   * Process PDF files using pdf-parse
   */
  private async processPDF(fileBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
    this.logger.stageProgress('Extracting text from PDF...');
    
    try {
      // Dynamically import the core pdf-parse implementation to avoid bundling test assets at build time
      // Some versions of pdf-parse can reference test data when statically imported during bundling
      const pdfModule: any = await import('pdf-parse/lib/pdf-parse.js');
      const pdfFn = pdfModule?.default ?? pdfModule;

      const pdfData = await pdfFn(fileBuffer, {
        // PDF parsing options
        max: 0 // Parse all pages
      });

      this.logger.info(`PDF parsed: ${pdfData.numpages} pages`);
      
      return {
        text: pdfData.text,
        pageCount: pdfData.numpages
      };
    } catch (error) {
      throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process DOCX files using mammoth
   */
  private async processDOCX(fileBuffer: Buffer): Promise<string> {
    this.logger.stageProgress('Extracting text from DOCX...');
    
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      
      if (result.messages.length > 0) {
        this.logger.warn(`DOCX processing warnings: ${result.messages.length} messages`);
        result.messages.forEach(msg => {
          this.logger.warn(`- ${msg.message}`);
        });
      }

      return result.value;
    } catch (error) {
      throw new Error(`DOCX processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process HTML files using JSDOM
   */
  private async processHTML(fileBuffer: Buffer): Promise<string> {
    this.logger.stageProgress('Extracting text from HTML...');
    
    try {
      const htmlContent = fileBuffer.toString('utf-8');
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;

      // Remove script and style elements
      const scripts = document.querySelectorAll('script, style');
      scripts.forEach(element => element.remove());

      // Extract text content
      const text = document.body?.textContent || document.textContent || '';
      
      return text;
    } catch (error) {
      throw new Error(`HTML processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process plain text files (TXT, MD)
   */
  private async processPlainText(fileBuffer: Buffer): Promise<string> {
    this.logger.stageProgress('Reading plain text file...');
    
    try {
      // Try UTF-8 first, fallback to latin1 if needed
      let text: string;
      try {
        text = fileBuffer.toString('utf-8');
      } catch {
        text = fileBuffer.toString('latin1');
      }

      return text;
    } catch (error) {
      throw new Error(`Plain text processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string): string {
    return text
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      // Trim
      .trim();
  }
}

export default FileProcessor;
