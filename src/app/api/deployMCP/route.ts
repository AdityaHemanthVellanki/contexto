import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { exportMCPBundle } from '@/lib/mcp-exporter';
import { getFirestore } from '@/lib/firebase-admin';
import { z } from 'zod';

// Request schema validation
const DeployMCPSchema = z.object({
  pipelineId: z.string().min(1),
  appName: z.string().optional()
});

interface DeployMCPRequest {
  pipelineId: string;
  appName?: string;
}

/**
 * Create Heroku app via API
 */
async function createHerokuApp(appName: string, userId: string): Promise<{
  name: string;
  web_url: string;
}> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  const response = await fetch('https://api.heroku.com/apps', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HEROKU_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.heroku+json; version=3'
    },
    body: JSON.stringify({
      name: appName,
      region: process.env.HEROKU_REGION || 'us',
      stack: 'heroku-22'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create Heroku app: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Set Heroku config vars
 */
async function setHerokuConfigVars(appName: string): Promise<void> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  const configVars = {
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || '',
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
    AZURE_OPENAI_DEPLOYMENT_EMBEDDING: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || '',
    AZURE_OPENAI_DEPLOYMENT_TURBO: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || '',
    AZURE_OPENAI_DEPLOYMENT_GPT4: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || '',
    AZURE_OPENAI_DEPLOYMENT_OMNI: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI || '',
    PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
    PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT || '',
    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID || '',
    CF_R2_ACCESS_KEY_ID: process.env.CF_R2_ACCESS_KEY_ID || '',
    CF_R2_SECRET_ACCESS_KEY: process.env.CF_R2_SECRET_ACCESS_KEY || '',
    CF_R2_BUCKET_NAME: process.env.CF_R2_BUCKET_NAME || ''
  };

  const response = await fetch(`https://api.heroku.com/apps/${appName}/config-vars`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${HEROKU_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.heroku+json; version=3'
    },
    body: JSON.stringify(configVars)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to set config vars: ${error.message || response.statusText}`);
  }
}

/**
 * Deploy source to Heroku using source blob
 */
async function deployToHeroku(appName: string, sourceUrl: string): Promise<{
  id: string;
  status: string;
}> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  // First, verify the source URL is accessible
  const headResponse = await fetch(sourceUrl, { method: 'HEAD' });
  if (!headResponse.ok) {
    throw new Error(`Source URL is not accessible: ${headResponse.statusText}`);
  }

  // Create build
  const response = await fetch(`https://api.heroku.com/apps/${appName}/builds`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HEROKU_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.heroku+json; version=3'
    },
    body: JSON.stringify({
      source_blob: {
        url: sourceUrl
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create build: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Poll build status
 */
async function pollBuildStatus(appName: string, buildId: string, maxWaitTime = 180000): Promise<{
  status: string;
  output_stream_url?: string;
}> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`https://api.heroku.com/apps/${appName}/builds/${buildId}`, {
      headers: {
        'Authorization': `Bearer ${HEROKU_API_KEY}`,
        'Accept': 'application/vnd.heroku+json; version=3'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get build status: ${response.statusText}`);
    }

    const build = await response.json();
    
    if (build.status === 'succeeded') {
      return { status: 'succeeded' };
    } else if (build.status === 'failed') {
      return { 
        status: 'failed', 
        output_stream_url: build.output_stream_url 
      };
    }

    // Wait 5 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Build timeout: deployment took longer than 3 minutes');
}

/**
 * POST /api/deployMCP - Deploy MCP pipeline to Heroku
 */
export const POST = withAuth(async (req) => {
  try {
    const body: DeployMCPRequest = await req.json();
    const validation = DeployMCPSchema.safeParse(body);
    
    if (!validation.success) {
      return errorResponse('Invalid request data: ' + validation.error.message);
    }
    
    const { pipelineId, appName: customAppName } = validation.data;
    
    // Generate app name if not provided
    const timestamp = Date.now();
    const appName = customAppName || `ctx-mcp-${req.userId.slice(0, 8)}-${timestamp}`.toLowerCase();
    
    // Validate app name format (Heroku requirements)
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(appName) || appName.length > 30) {
      return errorResponse('Invalid app name. Must be lowercase, start with a letter, contain only letters, numbers, and dashes, and be under 30 characters.');
    }

    console.log(`Starting MCP deployment for pipeline ${pipelineId} to app ${appName}`);

    // Step 1: Export MCP bundle
    console.log('Exporting MCP bundle...');
    const exportResult = await exportMCPBundle(pipelineId, req.userId);
    
    // Step 2: Create Heroku app
    console.log('Creating Heroku app...');
    const app = await createHerokuApp(appName, req.userId);
    
    // Step 3: Set config vars
    console.log('Setting config vars...');
    await setHerokuConfigVars(app.name);
    
    // Step 4: Deploy source
    console.log('Deploying source...');
    const build = await deployToHeroku(app.name, exportResult.downloadUrl);
    
    // Step 5: Poll build status
    console.log('Waiting for build to complete...');
    const buildResult = await pollBuildStatus(app.name, build.id);
    
    if (buildResult.status !== 'succeeded') {
      throw new Error(`Build failed. Check build logs: ${buildResult.output_stream_url}`);
    }

    // Store deployment metadata in Firestore
    const db = await getFirestore();
    const deploymentMetadata = {
      id: build.id,
      pipelineId,
      userId: req.userId,
      appName: app.name,
      appUrl: app.web_url,
      exportId: exportResult.exportId,
      status: 'deployed',
      createdAt: new Date(),
      buildId: build.id
    };
    
    await db.collection('deployments').doc(build.id).set(deploymentMetadata);

    return successResponse({
      message: 'MCP pipeline deployed successfully',
      deployment: {
        appName: app.name,
        appUrl: app.web_url,
        buildId: build.id,
        exportId: exportResult.exportId,
        status: 'deployed'
      }
    });

  } catch (error) {
    console.error('MCP deployment error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(`Deployment failed: ${errorMessage}`, 500);
  }
});
