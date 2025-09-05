// Type declarations for modules without TypeScript definitions

declare module '@pinecone-database/pinecone' {
  export class Pinecone {
    constructor(options: { apiKey: string });
    index(indexName: string): PineconeIndex;
  }

  export interface PineconeIndex {
    upsert(vectors: PineconeVector[]): Promise<any>;
    query(options: {
      vector: number[];
      topK: number;
      includeMetadata: boolean;
    }): Promise<{
      matches?: PineconeMatch[];
    }>;
  }

  export interface PineconeVector {
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }

  export interface PineconeMatch {
    id: string;
    score?: number;
    metadata?: Record<string, any>;
  }
}

declare module '@qdrant/js-client-rest' {
  export class QdrantClient {
    constructor(options: { url: string; apiKey?: string });
    upsertPoints(collectionName: string, options: {
      wait: boolean;
      points: QdrantPoint[];
    }): Promise<any>;
    searchPoints(collectionName: string, options: {
      vector: number[];
      limit: number;
      withPayload: boolean;
    }): Promise<{
      points: QdrantSearchResult[];
    }>;
  }

  export interface QdrantPoint {
    id: string;
    vector: number[];
    payload?: Record<string, unknown>;
  }

  export interface QdrantSearchResult {
    id: string;
    score: number;
    payload?: Record<string, unknown>;
  }
}

declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string): SupabaseClient;
  
  export interface SupabaseClient {
    from(table: string): SupabaseQueryBuilder;
    rpc(functionName: string, params?: Record<string, any>): Promise<{ 
      data: any[] | null;
      error: Error | null;
    }>;
  }

  export interface SupabaseQueryBuilder {
    upsert(rows: any[]): Promise<{
      data: any[] | null;
      error: Error | null;
    }>;
  }
}

declare module 'pdf-parse' {
  function pdfParse(dataBuffer: Buffer, options?: any): Promise<{
    text: string;
    numpages: number;
    info: Record<string, any>;
  }>;
  export = pdfParse;
}

// Support dynamic import of the internal pdf-parse implementation used to avoid build-time test asset references
declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdfParse(dataBuffer: Buffer, options?: any): Promise<{
    text: string;
    numpages: number;
    info: Record<string, any>;
  }>;
  export = pdfParse;
}

declare module 'mammoth' {
  export function extractRawText(options: {
    path?: string;
    buffer?: Buffer;
  }): Promise<{
    value: string;
    messages: any[];
  }>;
}

declare module 'xlsx' {
  export function read(data: Buffer, options?: any): WorkBook;
  export const utils: {
    sheet_to_json<T>(worksheet: WorkSheet, options?: any): T[];
    sheet_to_csv(worksheet: WorkSheet, options?: any): string;
  };
  
  export interface WorkBook {
    SheetNames: string[];
    Sheets: {
      [key: string]: WorkSheet;
    };
  }
  
  export interface WorkSheet {
    [key: string]: any;
  }
}

declare module 'tesseract.js' {
  export function recognize(
    image: Buffer | string,
    lang?: string,
    options?: any
  ): Promise<{
    data: {
      text: string;
    };
  }>;
}
