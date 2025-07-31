/**
 * Module declarations for libraries without TypeScript definitions
 */

declare module '@/lib/auth' {
  import { NextRequest } from 'next/server';
  
  export function verifyIdToken(token: string): Promise<any>;
  export function getUserFromToken(token: string): Promise<string>;
  export function ensureAuthenticated(request: Request): Promise<string>;
  export function verifyAuth(request: NextRequest): Promise<{ 
    success: boolean; 
    userId?: string; 
    error?: string 
  }>;
}

declare module '@/lib/storage' {
  export function getFileUploadUrl(
    userId: string,
    fileName: string,
    contentType: string
  ): Promise<{ uploadUrl: string; fileId: string; key: string }>;
  
  export function getFileDownloadUrl(key: string): Promise<string>;
  
  export function getFileDownloadUrls(
    files: Array<{ fileId: string; key: string; fileName: string; contentType: string }>
  ): Promise<Array<{ url: string; fileId: string; fileName: string; contentType: string }>>;
}

declare module '@/lib/text-processor' {
  export function chunkText(text: string): string[];
  
  export function extractTextFromFile(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<string>;
  
  export function processFileToChunks(
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
  }>>;
  
  export function cleanText(text: string): string;
  
  export function extractTextFromFiles(
    urls: Array<{ url: string; fileName: string; fileId: string; contentType: string }>
  ): Promise<Array<{ text: string; fileName: string; fileId: string }>>;
}

declare module '@/lib/azure-openai' {
  import OpenAI from 'openai';
  
  export function getAzureOpenAIClient(): OpenAI;
  
  export function generateEmbeddings(text: string): Promise<number[]>;
  
  export function generateChatCompletion(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    model?: 'turbo' | 'gpt4' | 'omni',
    stream?: boolean
  ): Promise<any>;
  
  export function streamChatCompletion(
    messages: Array<{ role: string; content: string }>,
    model?: 'turbo' | 'gpt4' | 'omni'
  ): Promise<Response>;
}
