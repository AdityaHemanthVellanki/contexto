import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import JSZip from 'jszip';

// Import types from the Cloudflare Workers runtime
type R2Bucket = any; // This will be provided by the Cloudflare Workers runtime

interface Env {
  UPLOADS: R2Bucket;
  AZURE_OPENAI_KEY: string;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYID: string;
  PINECONE_API_KEY: string;
  PINECONE_ENV: string;
}

interface MCPParams {
  chunkSize: number;
  chunkOverlap: number;
  modelName: string;
}

const DEFAULT_MCP_PARAMS: MCPParams = {
  chunkSize: 1000,
  chunkOverlap: 200,
  modelName: 'text-embedding-ada-002'
};

interface ProcessRequest {
  userId: string;
  fileKey: string;
  mcpParams?: Partial<MCPParams>;
}

interface ProcessResponse {
  success: boolean;
  downloadUrl: string;
  key: string;
  metadata: {
    chunksCount: number;
    vectorCount: number;
    processingTimeMs: number;
  };
  error?: string;
}

interface PipelineResult {
  success: boolean;
  chunks: Array<{
    text: string;
    embedding: number[];
    metadata: Record<string, any>;
  }>;
  metadata: {
    chunkSize: number;
    chunkOverlap: number;
    model: string;
    timestamp: string;
  };
}

async function processFile(
  buffer: ArrayBuffer,
  params: ProcessRequest['mcpParams'] = {},
  env: Env
): Promise<PipelineResult> {
  // Merge default params with provided params
  const mergedParams: MCPParams = {
    ...DEFAULT_MCP_PARAMS,
    ...params,
  };
  
  const { chunkSize, chunkOverlap, modelName } = mergedParams;
  // Initialize Azure OpenAI client
  const openai = new OpenAI({
    apiKey: env.AZURE_OPENAI_KEY,
    baseURL: `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${env.AZURE_OPENAI_DEPLOYID}`,
    defaultQuery: { 'api-version': '2023-05-15' },
    defaultHeaders: { 'api-key': env.AZURE_OPENAI_KEY },
  });

  // Initialize Pinecone client with v1 configuration
  const pinecone = new Pinecone({
    apiKey: env.PINECONE_API_KEY,
    // @ts-ignore - Pinecone v1 uses 'environment' instead of 'cloud'
    environment: env.PINECONE_ENV,
  });

  // Convert buffer to text (assuming text files for now)
  const text = new TextDecoder().decode(buffer);
  
  // Simple text chunking (assuming text files for now)
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  // Generate embeddings for each chunk
  const embeddings: Array<{
    text: string;
    embedding: number[];
    metadata: {
      chunkSize: number;
      chunkOverlap: number;
    };
  }> = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const response = await openai.embeddings.create({
      model: modelName,
      input: chunk,
    });
    
    embeddings.push({
      text: chunk,
      embedding: response.data[0].embedding,
      metadata: {
        chunkSize: chunk.length,
        chunkOverlap: Math.min(chunkOverlap, i > 0 ? chunkOverlap : 0),
      },
    });
  }

  // Store embeddings in Pinecone
  const index = pinecone.index('contexto');
  const vectors = embeddings.map((item, idx) => ({
    id: `chunk-${Date.now()}-${idx}`,
    values: item.embedding,
    metadata: {
      text: item.text,
      ...item.metadata,
    },
  }));

  await index.upsert(vectors);

  return {
    success: true,
    chunks: embeddings,
    metadata: {
      chunkSize,
      chunkOverlap,
      model: modelName,
      timestamp: new Date().toISOString(),
    },
  };
}

async function createPipelineZip(result: PipelineResult): Promise<ArrayBuffer> {
  const zip = new JSZip();
  
  // Add pipeline configuration
  zip.file('pipeline.json', JSON.stringify({
    version: '1.0',
    metadata: result.metadata,
    chunksCount: result.chunks.length,
    createdAt: new Date().toISOString(),
  }));

  // Add chunks as separate files
  const chunksFolder = zip.folder('chunks');
  result.chunks.forEach((chunk, index) => {
    chunksFolder?.file(`chunk-${index}.json`, JSON.stringify(chunk, null, 2));
  });

  // Generate the zip file
  return zip.generateAsync({ type: 'arraybuffer' });
}

export async function handleProcess(
  request: Request,
  env: Env
): Promise<Response> {
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        } 
      }
    );
  }

  const startTime = Date.now();
  let response: any;

  try {
    const { userId, fileKey, mcpParams = {} } = await request.json() as ProcessRequest;
    
    if (!userId || !fileKey) {
      response = {
        success: false,
        downloadUrl: '',
        key: '',
        metadata: {
          chunksCount: 0,
          vectorCount: 0,
          processingTimeMs: 0,
        },
        error: 'Missing required fields (userId or fileKey)',
      };
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      );
    }

    // Get the file from R2
    const file = await env.UPLOADS.get(fileKey);
    if (!file) {
      response = {
        success: false,
        downloadUrl: '',
        key: '',
        metadata: {
          chunksCount: 0,
          vectorCount: 0,
          processingTimeMs: 0,
        },
        error: 'File not found',
      };
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      );
    }

    // Read the file content
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    
    // Process the text (chunking, embeddings, etc.)
    const chunks = chunkText(text, mcpParams?.chunkSize || 1000, mcpParams?.chunkOverlap || 200);
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: env.AZURE_OPENAI_KEY,
      baseURL: `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${env.AZURE_OPENAI_DEPLOYID}`,
      defaultQuery: { 'api-version': '2023-05-15' },
      defaultHeaders: { 'api-key': env.AZURE_OPENAI_KEY },
    });

    // Initialize Pinecone client with v1 configuration
    const pinecone = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
      // @ts-ignore - Pinecone v1 uses 'environment' instead of 'cloud'
      environment: env.PINECONE_ENV,
    });

    // Generate embeddings for each chunk
    const embeddings: any[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const response = await openai.embeddings.create({
        model: mcpParams?.modelName || 'text-embedding-ada-002',
        input: chunk,
      });
      
      embeddings.push({
        text: chunk,
        embedding: response.data[0].embedding,
        metadata: {
          chunkSize: chunk.length,
          chunkOverlap: Math.min(mcpParams?.chunkOverlap || 200, i > 0 ? (mcpParams?.chunkOverlap || 200) : 0),
        },
      });
    }

    // Store embeddings in Pinecone
    const index = pinecone.index('contexto-embeddings');
    const vectors = embeddings.map((embedding, i) => ({
      id: `${fileKey}-${i}`,
      values: embedding.embedding,
      metadata: {
        ...embedding.metadata,
        fileKey,
        userId,
        chunkIndex: i,
      },
    }));
    
    await index.upsert(vectors);

    // Create a ZIP file with the processed data
    const zip = new JSZip();
    zip.file('chunks.json', JSON.stringify(chunks, null, 2));
    zip.file('embeddings.json', JSON.stringify(embeddings, null, 2));
    
    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Save the ZIP file to R2
    const exportKey = `${userId}/exports/${Date.now()}_processed.zip`;
    await env.UPLOADS.put(exportKey, zipContent, {
      httpMetadata: {
        contentType: 'application/zip',
      },
      customMetadata: {
        userId,
        originalFile: fileKey,
        processedAt: new Date().toISOString(),
      },
    });

    // Generate a presigned URL for the ZIP file
    const signedUrl = await env.UPLOADS.getSignedUrl(
      exportKey,
      { expiresIn: 3600 * 24 } // 24 hours
    );

    response = {
      success: true,
      downloadUrl: signedUrl.toString(),
      key: exportKey,
      metadata: {
        chunksCount: chunks.length,
        vectorCount: vectors.length,
        processingTimeMs: Date.now() - startTime,
      },
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Processing error:', error);
    
    response = {
      success: false,
      downloadUrl: '',
      key: '',
      metadata: {
        chunksCount: 0,
        vectorCount: 0,
        processingTimeMs: Date.now() - startTime,
      },
      error: error instanceof Error ? error.message : 'Unknown error during processing',
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

// Helper function to chunk text
function chunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    
    if (end >= text.length) break;
    start = end - Math.min(chunkOverlap, chunkSize / 2);
  }
  
  return chunks;
}
