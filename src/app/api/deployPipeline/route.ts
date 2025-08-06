import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex } from '@/lib/pinecone';
import { authenticateRequest } from '@/lib/api-auth';
import { deployToHeroku, sanitizeAppName } from '@/lib/heroku';
import { hasProperty } from '@/lib/typeUtils';

export const runtime = 'nodejs';

interface DeployToHerokuParams {
  pipelineId: string;
  envVars: Record<string, string>;
}

interface HerokuDeploymentResult {
  success: boolean;
  url?: string;
  vsixUrl?: string;
  error?: string;
  app?: any;
  build?: any;
  webUrl?: string;
}

interface DeployPipelineRequestBody {
  pipelineId: string;
  fileId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = authResult.userId;

    const body = await request.json();
    
    if (!hasProperty(body, 'pipelineId') || !hasProperty(body, 'fileId')) {
      return NextResponse.json(
        { error: 'Missing required parameters: pipelineId or fileId' },
        { status: 400 }
      );
    }
    
    const { pipelineId, fileId } = body as DeployPipelineRequestBody;

    console.log(`Starting deployment for pipeline ${pipelineId}, file ${fileId}`);

    // Step 1: Process documents and store in vector store if needed
    const vectorIndex = getPineconeIndex();
    
    // Here you would typically fetch the file content and process it
    // For now, we'll just log that we're skipping this step
    console.log('Skipping document processing in this example');

    // Step 2: Deploy to Heroku
    console.log('Deploying to Heroku...');
    
    // Generate a sanitized app name for this deployment
    const rawAppName = `contexto-${pipelineId}`;
    const appName = sanitizeAppName(rawAppName);
    console.log(`Generated app name: ${appName} (from raw: ${rawAppName})`);
    
    // Get the source blob URL from environment variables or use a default
    const sourceBlobUrl = process.env.HEROKU_SOURCE_BLOB_URL || 'https://github.com/your-org/contexto-mcp-server/tarball/main';
    
    // Prepare environment variables
    const envVars = {
      NODE_ENV: 'production',
      PIPELINE_ID: pipelineId,
      // Add any additional environment variables needed by the MCP server
      ...(process.env.VECTOR_STORE_ENDPOINT && { 
        VECTOR_STORE_ENDPOINT: process.env.VECTOR_STORE_ENDPOINT 
      }),
      ...(process.env.STORE_TYPE && { 
        STORE_TYPE: process.env.STORE_TYPE 
      })
    };
    
    // Deploy to Heroku
    const deployment = await deployToHeroku({
      appName,
      pipelineId,
      userId,
      envVars,
      version: pipelineId // Using pipelineId as the version
    });

    if (!deployment.success) {
      throw new Error(deployment.error || 'Failed to deploy to Heroku');
    }

    // Return success response with deployment details
    return NextResponse.json({
      success: true,
      mcpUrl: deployment.url || deployment.webUrl,
      vsixUrl: deployment.vsixUrl
    });
  } catch (error) {
    console.error('Error in deployPipeline:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
