import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { getR2Client, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for exportMCP API');
} catch (error) {
  console.error('❌ Firebase initialization failed in exportMCP API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting - 5 requests per 30 seconds per user/IP
    const identifier = request.headers.get('x-user-id') || 'anonymous';
    const rateLimitResult = await rateLimit.limit(identifier);
    
    if (rateLimitResult.limited) {
      return rateLimitResult.response || NextResponse.json(
        { message: 'Rate limit exceeded', error: 'rate_limited' },
        { status: 429 }
      );
    }
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { message: 'Authentication required', error: 'unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.user.uid;
    const body = await request.json();
    const { pipelineId, fileId } = body;

    if (!pipelineId || !fileId) {
      return NextResponse.json(
        { message: 'pipelineId and fileId are required', error: 'invalid_request' },
        { status: 400 }
      );
    }

    // Get pipeline data from Firestore
    const db = getFirestore();
    const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();
    
    if (!pipelineDoc.exists) {
      return NextResponse.json(
        { message: 'Pipeline not found', error: 'not_found' },
        { status: 404 }
      );
    }

    const pipelineData = pipelineDoc.data();
    if (!pipelineData) {
      return NextResponse.json(
        { message: 'Pipeline data is empty', error: 'invalid_data' },
        { status: 400 }
      );
    }
    
    // Create MCP server package
    const zip = new JSZip();
    
    // Add server files to ZIP
    zip.file('package.json', JSON.stringify({
      name: `mcp-server-${pipelineData.name || 'pipeline'}`,
      version: '1.0.0',
      type: 'module',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'node --watch index.js'
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^0.5.0',
        'express': '^4.18.0',
        'cors': '^2.8.5',
        'dotenv': '^16.0.0'
      }
    }, null, 2));

    const serverCode = `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

dotenv.config();

const server = new Server(
  {
    name: '${pipelineData?.name || 'mcp-pipeline'}',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools based on pipeline
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_${pipelineData?.name || 'pipeline'}',
      description: 'Query the ${pipelineData?.name || 'pipeline'} data',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The query to execute'
          }
        },
        required: ['query']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'query_${pipelineData?.name || 'pipeline'}') {
    // Implementation for querying pipeline
    return {
      content: [
        {
          type: 'text',
          text: 'Query executed successfully'
        }
      ]
    };
  }
  
  throw new Error('Unknown tool');
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
`;
    
    zip.file('index.js', serverCode);


    
    zip.file('index.js', serverCode);
    
    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Generate unique filename and upload to R2
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const filename = `mcp-exports/${exportId}.zip`;
    
    const r2Client = getR2Client();
    if (!r2Client) {
      throw new Error('R2 client not initialized');
    }
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: filename,
      Body: zipBuffer,
      ContentType: 'application/zip',
    }));
    
    const downloadUrl = `https://r2.contexto.ai/${filename}`;
    
    // Create export record in Firestore
    const exportRef = db.collection('exports').doc(exportId);
    
    await exportRef.set({
      userId,
      pipelineId,
      downloadUrl,
      status: 'completed',
      fileType: 'mcp-pipeline',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      metadata: {
        exportType: 'mcp',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`MCP pipeline exported successfully: ${downloadUrl}`);
    
    // Return JSON with download URL and exportId for tracking
    return NextResponse.json({
      downloadUrl,
      exportId,
      pipelineId
    });

  } catch (error) {
    console.error('MCP export error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: `MCP export failed: ${message}` }, { status: 500 });
  }
}
