import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { r2, R2_BUCKET } from '@/lib/r2';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { deployToHeroku } from '@/lib/heroku-deploy';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for deployServer API');
} catch (error) {
  console.error('❌ Firebase initialization failed in deployServer API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

// Request schema validation
const DeployServerSchema = z.object({
  pipelineId: z.string().min(1),
  fileId: z.string().min(1)
});

// Heroku deployment file structure
interface HerokuFile {
  file: string;
  data: string;
}

// Promisify exec for async usage
const execAsync = promisify(exec);

// Generate VS Code extension and upload to R2
async function generateVSCodeExtension(pipelineId: string, mcpUrl: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `vscode-ext-${pipelineId}`);
  const templateDir = path.join(process.cwd(), 'vscode-extension-template');
  
  try {
    // Copy template to temp directory
    await execAsync(`cp -r "${templateDir}" "${tempDir}"`);
    
    // Update package.json with MCP endpoint
    const packageJsonPath = path.join(tempDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    // Set default endpoint in configuration
    packageJson.contributes.configuration.properties['contexto.endpoint'].default = mcpUrl;
    
    // Write updated package.json
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    // Update extension.ts to embed MCP URL as constant
    const extensionPath = path.join(tempDir, 'src', 'extension.ts');
    let extensionCode = await fs.readFile(extensionPath, 'utf8');
    extensionCode = extensionCode.replace(
      'PLACEHOLDER_MCP_URL',
      mcpUrl
    );
    await fs.writeFile(extensionPath, extensionCode);
    
    // Install dependencies and compile
    await execAsync('npm install', { cwd: tempDir });
    await execAsync('npm run compile', { cwd: tempDir });
    
    // Package with vsce
    const vsixPath = path.join(tempDir, `contexto-mcp-client-1.0.0.vsix`);
    await execAsync(`vsce package --out "${vsixPath}"`, { cwd: tempDir });
    
    // Upload to R2
    const vsixBuffer = await fs.readFile(vsixPath);
    const r2Key = `vsixs/${pipelineId}.vsix`;
    
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: vsixBuffer,
      ContentType: 'application/octet-stream'
    }));
    
    // Clean up temp directory
    await execAsync(`rm -rf "${tempDir}"`);
    
    // Return R2 URL
    return `https://${process.env.R2_PUBLIC_URL}/${r2Key}`;
    
  } catch (error) {
    // Clean up on error
    try {
      await execAsync(`rm -rf "${tempDir}"`);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    throw error;
  }
}

// Generate OpenAPI specification for the MCP server
function generateOpenAPISpec(pipelineId: string, purpose: string): string {
  return JSON.stringify({
    openapi: '3.0.0',
    info: {
      title: `MCP Server - ${pipelineId}`,
      description: `Model Context Protocol server for: ${purpose}`,
      version: '1.0.0'
    },
    servers: [
      {
        url: 'https://your-app-name.herokuapp.com',
        description: 'Heroku production server'
      }
    ],
    paths: {
      '/mcp': {
        post: {
          summary: 'MCP Protocol Endpoint',
          description: 'Main endpoint for Model Context Protocol communication',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    method: { type: 'string' },
                    params: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      result: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/health': {
        get: {
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Server is healthy'
            }
          }
        }
      }
    }
  }, null, 2);
}

// Generate MCP server function for Heroku deployment
function generateMCPServerFunction(pipelineId: string, vectorStoreEndpoint: string, storeType: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import { initVectorStoreClient } from '../vectorStoreClient';

// MCP Server for Pipeline: ${pipelineId}
// Generated by Contexto

const PIPELINE_ID = '${pipelineId}';

// Initialize vector store from environment variables
const store = initVectorStoreClient({
  type: process.env.VECTOR_STORE_TYPE,
  config: JSON.parse(process.env.VECTOR_STORE_CONFIG || '{}')
});

// Log successful initialization
console.log(\`Vector store initialized: \${process.env.VECTOR_STORE_TYPE}\`);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, params } = body;

    switch (method) {
      case 'tools/list':
        return NextResponse.json({
          tools: [
            {
              name: 'process_data',
              description: 'Process data through the MCP pipeline',
              inputSchema: {
                type: 'object',
                properties: {
                  input: {
                    type: 'string',
                    description: 'Input data to process'
                  },
                  options: {
                    type: 'object',
                    properties: {
                      topK: { type: 'number', default: 5 },
                      threshold: { type: 'number', default: 0.7 }
                    }
                  }
                },
                required: ['input']
              }
            },
            {
              name: 'get_pipeline_info',
              description: 'Get information about this MCP pipeline',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            }
          ]
        });

      case 'tools/call':
        const { name, arguments: args } = params;
        
        if (name === 'process_data') {
          const { input, options = {} } = args;
          const { topK = 5 } = options;
          
          try {
            // Generate embeddings for the input
            // In a production environment, this would use a proper embeddings model
            const embedding = await generateEmbedding(input);
            
            // Query the vector store
            const results = await store.query(embedding, topK);
            
            // Process the results
            const context = results.map((result, i) => 
              \`[Context \${i+1}] \${result.metadata.text || 'No text available'}\`
            ).join('\\n\\n');
            
            return NextResponse.json({
              result: {
                processed: true,
                message: \`Processed input with \${results.length} context chunks\`,
                pipelineId: PIPELINE_ID,
                context: context,
                topMatches: results.length
              }
            });
          };

          return NextResponse.json({
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          });
        }

        if (name === 'get_pipeline_info') {
          return NextResponse.json({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  pipelineId: PIPELINE_ID,
                  vectorStore: {
                    type: STORE_TYPE,
                    endpoint: VECTOR_STORE_ENDPOINT
                  },
                  status: 'deployed',
                  version: '1.0.0'
                }, null, 2)
              }
            ]
          });
        }

        return NextResponse.json({
          error: { code: -32601, message: 'Method not found' }
        }, { status: 404 });

      default:
        return NextResponse.json({
          error: { code: -32601, message: 'Method not found' }
        }, { status: 404 });
    }
  } catch (error) {
    console.error('MCP Server error:', error);
    return NextResponse.json({
      error: { 
        code: -32603, 
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    pipelineId: PIPELINE_ID,
    timestamp: new Date().toISOString()
  });
}
`;
}

// This function is no longer used - we use verifyHerokuDeployment instead
async function verifyRailwayDeployment(pipelineId: string): Promise<{ verified: boolean; status: string; message: string }> {
  console.warn('verifyRailwayDeployment is deprecated, use verifyHerokuDeployment instead');
  return {
    verified: false,
    status: 'error',
    message: 'Railway deployments are no longer supported. Use Heroku deployments instead.'
  };
}

// Verify Heroku deployment by checking the app URL
async function verifyHerokuDeployment(appUrl: string): Promise<{ verified: boolean; status: string; message: string }> {
  try {
    // Try to fetch the app URL to verify it's responding
    const response = await fetch(`${appUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      return {
        verified: true,
        status: 'success',
        message: `Heroku deployment at ${appUrl} verified successfully`
      };
    } else {
      return {
        verified: false,
        status: 'warning',
        message: `Heroku app is deployed but health check returned ${response.status}`
      };
    }
  } catch (error) {
    console.error('Heroku verification error:', error);
    return {
      verified: false,
      status: 'error',
      message: `❌ Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Get vector store specific configuration
export function getVectorStoreApiKey(storeType: string): string {
  switch (storeType) {
    case 'pinecone':
      return process.env.PINECONE_API_KEY || '';
    case 'qdrant':
      return process.env.QDRANT_API_KEY || '';
    case 'supabase':
      return process.env.SUPABASE_SERVICE_KEY || '';
    case 'firestore':
      return ''; // Firestore uses Firebase credentials
    default:
      return '';
  }
}

// Get store-specific configuration
export function getStoreSpecificConfig(storeType: string, pipelineId: string, userId: string): any {
  switch (storeType) {
    case 'pinecone':
      return {
        environment: process.env.PINECONE_ENVIRONMENT || '',
        index: process.env.PINECONE_INDEX || ''
      };
    case 'qdrant':
      return {
        collection: `${userId}_${pipelineId}`.replace(/[^a-zA-Z0-9_]/g, '_')
      };
    case 'supabase':
      return {
        supabaseUrl: process.env.SUPABASE_URL || '',
        table: `${userId}_${pipelineId}`.replace(/[^a-zA-Z0-9_]/g, '_')
      };
    case 'firestore':
      return {
        collection: `${userId}_${pipelineId}_embeddings`.replace(/[^a-zA-Z0-9_]/g, '_')
      };
    default:
      return {};
  }
}

// Generate embedding function
export function generateEmbedding(text: string): Promise<number[]> {
  // Implementation would go here
  // This is a placeholder that would be replaced with actual embedding generation
  return Promise.resolve([]);
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 3,
      windowSizeInSeconds: 600 // 3 requests per 10 minutes
    });

    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Too many deployment requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response || NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = DeployServerSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.issues
      }, { status: 400 });
    }

    const { pipelineId, fileId } = validationResult.data;

    // Load pipeline metadata
    const firestore = initializeFirebaseAdmin();
    const pipelineDoc = await firestore.collection('pipelines').doc(pipelineId).get();
    if (!pipelineDoc.exists) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const pipelineData = pipelineDoc.data()!;
    if (pipelineData.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized access to pipeline' }, { status: 403 });
    }

    // Check if vector store is deployed
    // Using the firestore instance we already initialized above
    const vectorStoreDoc = await firestore.collection('deployments').doc(`${userId}_${pipelineId}_vectorstore`).get();
    if (!vectorStoreDoc.exists) {
      return NextResponse.json({ 
        error: 'Vector store must be deployed first. Please deploy the vector store before deploying the server.' 
      }, { status: 400 });
    }

    const vectorStoreData = vectorStoreDoc.data()!;
    const vectorStoreEndpoint = vectorStoreData.endpoint;
    const storeType = vectorStoreData.storeType;

    // Check if server is already deployed
    // Using the firestore instance we already initialized above
    const existingDeployment = await firestore.collection('deployments').doc(`${userId}_${pipelineId}_server`).get();
    if (existingDeployment.exists) {
      const deploymentData = existingDeployment.data()!;
      if (deploymentData.status === 'deployed') {
        return NextResponse.json({
          mcpUrl: deploymentData.url,
          deploymentId: deploymentData.deploymentId,
          message: 'Server already deployed'
        });
      }
    }
    
    // Read the vectorStoreClient.js template
    let vectorStoreClientTemplate;
    try {
      vectorStoreClientTemplate = await fs.readFile(
        path.join(process.cwd(), 'src/templates/vectorStoreClient.js'), 
        'utf-8'
      );
      console.log('Successfully loaded vectorStoreClient.js template');
    } catch (error) {
      console.error('Failed to read vectorStoreClient.js template:', error);
      return NextResponse.json({ error: 'Failed to prepare deployment files' }, { status: 500 });
    }

    // Create a JSON config object for the vector store
    const vectorStoreConfig = {
      endpoint: vectorStoreEndpoint,
      apiKey: getVectorStoreApiKey(storeType),
      ...getStoreSpecificConfig(storeType, pipelineId, userId)
    };

    console.log(`Vector store config prepared for ${storeType}`);

    // Prepare deployment files
    const files: HerokuFile[] = [
      {
        file: 'api/mcp.ts',
        data: generateMCPServerFunction(pipelineId, vectorStoreEndpoint, storeType)
      },
      {
        file: 'vectorStoreClient.js',
        data: vectorStoreClientTemplate
      },
      {
        file: 'package.json',
        data: JSON.stringify({
          name: `mcp-server-${pipelineId}`,
          version: '1.0.0',
          description: `MCP Server for pipeline ${pipelineId}`,
          main: 'api/mcp.ts',
          scripts: {
            build: 'tsc',
            start: 'node dist/api/mcp.js'
          },
          dependencies: {
            'next': '^14.0.0',
            '@types/node': '^20.0.0',
            'typescript': '^5.0.0'
          },
          engines: {
            node: '>=18.0.0'
          }
        }, null, 2)
      },
      {
        file: 'Procfile',
        data: 'web: npm start'
      },
      {
        file: 'openapi.yaml',
        data: generateOpenAPISpec(pipelineId, pipelineData.metadata?.purpose || 'MCP Pipeline')
      },
      {
        file: 'README.md',
        data: `# MCP Server - ${pipelineId}

This is an auto-deployed MCP (Model Context Protocol) server generated by Contexto.

## Endpoints

- \`POST /mcp\` - Main MCP protocol endpoint
- \`GET /health\` - Health check endpoint

## Usage

This server implements the MCP specification and can be used with any MCP-compatible client.

Vector Store: ${storeType}
Endpoint: ${vectorStoreEndpoint}

Generated on: ${new Date().toISOString()}
`
      }
    ];

    console.log(`Deploying MCP server for pipeline ${pipelineId} to Heroku...`);

    // First, get the pipeline export URL from R2
    // We need to call the export pipeline API to get the ZIP download URL
    const exportResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/exportMCP`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || ''
      },
      body: JSON.stringify({ pipelineId, fileId })
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.text();
      throw new Error(`Failed to export pipeline: ${error}`);
    }

    const exportData = await exportResponse.json();
    const downloadUrl = exportData.downloadUrl;

    if (!downloadUrl) {
      throw new Error('No download URL received from pipeline export');
    }

    console.log(`deployServer handler: resolved downloadUrl = ${downloadUrl}`);
    console.log(`Using pipeline ZIP from: ${downloadUrl}`);

    // Deploy to Heroku
    console.log('Initiating Heroku deployment with validated configuration...');
    let appUrl, appId;
    try {
      const deployResult = await deployToHeroku(pipelineId, downloadUrl, storeType, vectorStoreConfig);
      appUrl = deployResult.appUrl;
      appId = deployResult.appId;
      console.log(`Heroku deployment successful: ${appUrl}`);
    } catch (deployError) {
      console.error('Heroku deployment failed with error:', deployError);
      return NextResponse.json({
        error: deployError instanceof Error ? deployError.message : 'Heroku deployment failed',
        details: 'Please check your Heroku configuration and API key'
      }, { status: 500 });
    }

    // Verify Heroku deployment
    console.log('Verifying Heroku deployment...');
    const verificationResult = await verifyHerokuDeployment(appUrl);
    console.log(`Heroku verification result: ${verificationResult.message}`);

    // Log verification result for debugging but don't fail the deployment
    // This allows the deployment to proceed even if verification fails
    if (!verificationResult.verified) {
      console.warn(`Heroku deployment verification failed: ${verificationResult.message}`);
      // Still continue with the deployment process
    }
    
    // Generate VS Code extension
    console.log('Generating VS Code extension...');
    const vsixUrl = await generateVSCodeExtension(pipelineId, appUrl);

    // Save deployment metadata
    // Using the firestore instance we already initialized above
    await firestore.collection('deployments').doc(`${userId}_${pipelineId}_server`).set({
      userId,
      pipelineId,
      type: 'server',
      url: appUrl,
      serviceId: appId,
      vectorStoreEndpoint,
      storeType,
      status: 'deployed',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Log deployment
    // Using the firestore instance we already initialized above
    await firestore.collection('usage').add({
      userId,
      action: 'mcp_server_deployed',
      pipelineId,
      url: appUrl,
      serviceId: appId,
      timestamp: new Date()
    });

    return NextResponse.json({
      mcpUrl: appUrl,
      vsixUrl: vsixUrl,
      appId: appId,
      vectorStoreEndpoint,
      storeType,
      message: 'MCP server deployed successfully to Heroku',
      verification: {
        verified: verificationResult.verified,
        status: verificationResult.status,
        message: verificationResult.message
      }
    }, {
      status: 200,
      headers: rateLimitResult.headers
    });

  } catch (error: unknown) {
    console.error('MCP server deployment error:', error);
    
    // Extract detailed error information
    let errorMessage = 'Unknown deployment error';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }
    
    // Log detailed error for debugging
    console.error(`Deployment error details: ${errorMessage}\n${errorDetails}`);
    
    return NextResponse.json({
      error: errorMessage,
      details: 'Please check your Heroku configuration, API key, and network connectivity',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
