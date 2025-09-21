import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { exportMCPBundle } from '@/lib/mcp-exporter';
import { getFirestore } from '@/lib/firebase-admin';
import { z } from 'zod';
import { buildAndUploadVSIX } from '@/lib/vscode-extension-builder';

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
async function setHerokuConfigVars(appName: string, extra: Record<string, string> = {}): Promise<void> {
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
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
    PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT || '',
    PINECONE_INDEX: process.env.PINECONE_INDEX || process.env.PINECONE_INDEX_NAME || '',
    PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || '',
    PINECONE_NAMESPACE: process.env.PINECONE_NAMESPACE || '',
    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID || '',
    CF_R2_ACCESS_KEY_ID: process.env.CF_R2_ACCESS_KEY_ID || '',
    CF_R2_SECRET_ACCESS_KEY: process.env.CF_R2_SECRET_ACCESS_KEY || '',
    CF_R2_BUCKET_NAME: process.env.CF_R2_BUCKET_NAME || '',
    // Optional Firebase Admin for Firestore query logging from deployed MCP
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || ''
  };

  const response = await fetch(`https://api.heroku.com/apps/${appName}/config-vars`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${HEROKU_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.heroku+json; version=3'
    },
    body: JSON.stringify({ ...configVars, ...extra })
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
  output_stream_url?: string;
}> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  // First, verify the source URL is accessible using a minimal GET range probe
  // Some presigned URLs do not allow HEAD; Range GET is broadly supported
  const probeResponse = await fetch(sourceUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-15' }
  });
  if (!(probeResponse.ok || probeResponse.status === 206)) {
    throw new Error(`Source URL is not accessible (status ${probeResponse.status}): ${probeResponse.statusText}`);
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
  // Track created deployment document ID for failure updates across try/catch
  let deploymentDocId: string | null = null;
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

    // Initialize Firestore for deployment tracking
    const db = await getFirestore();

    // Load pipeline metadata and validate ownership
    const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();
    if (!pipelineDoc.exists) {
      return errorResponse('Pipeline not found', 404);
    }
    const pipelineData = pipelineDoc.data() as any;
    if (pipelineData.userId !== req.userId) {
      return errorResponse('Not authorized to deploy this pipeline', 403);
    }

    // Use the MCP bundle as a pipeline ingester

    const indexName = pipelineData.indexName || process.env.PINECONE_INDEX || process.env.PINECONE_INDEX_NAME || '';
    const namespace = pipelineData.namespace || '';
    const mcpId = pipelineData.mcpId || null;

    // Step 1: Export MCP bundle (tar.gz)
    console.log('Exporting MCP bundle...');
    const exportResult = await exportMCPBundle(pipelineId, req.userId);
    
    // Step 2: Create Heroku app
    console.log('Creating Heroku app...');
    const app = await createHerokuApp(appName, req.userId);
    
    // Step 3: Set config vars (inject pipeline-specific runtime)
    console.log('Setting config vars...');
    await setHerokuConfigVars(app.name, {
      MCP_USER_ID: req.userId,
      MCP_PIPELINE_ID: pipelineId,
      MCP_INDEX_NAME: indexName || '',
      MCP_NAMESPACE: namespace || '',
      PINECONE_INDEX: indexName || '',
      PINECONE_INDEX_NAME: indexName || '',
      PINECONE_NAMESPACE: namespace || ''
    });
    
    // Step 4: Deploy source
    console.log('Deploying source...');
    const build = await deployToHeroku(app.name, exportResult.downloadUrl);
    
    // Create initial deployment record (status: building)
    await db.collection('deployments').doc(build.id).set({
      id: build.id,
      pipelineId,
      userId: req.userId,
      appName: app.name,
      appUrl: app.web_url,
      status: 'building',
      createdAt: new Date(),
      updatedAt: new Date(),
      buildId: build.id,
      provider: 'heroku',
      logsUrl: build.output_stream_url || null
    });
    // Remember the doc id to allow terminal updates on errors/timeouts
    deploymentDocId = build.id;
    
    // Step 5: Poll build status
    console.log('Waiting for build to complete...');
    const buildResult = await pollBuildStatus(app.name, build.id);
    
    if (buildResult.status !== 'succeeded') {
      await db.collection('deployments').doc(build.id).set({
        status: 'failed',
        updatedAt: new Date(),
        error: `Build failed. Check build logs: ${buildResult.output_stream_url}`
      }, { merge: true });
      throw new Error(`Build failed. Check build logs: ${buildResult.output_stream_url}`);
    }

    // Update deployment record (status: deployed)
    await db.collection('deployments').doc(build.id).set({
      status: 'deployed',
      updatedAt: new Date(),
      exportId: exportResult.exportId
    }, { merge: true });

    // Update pipeline document with deployment info
    await db.collection('pipelines').doc(pipelineId).set({
      deployment: {
        provider: 'heroku',
        appName: app.name,
        appUrl: app.web_url,
        buildId: build.id,
        status: 'deployed',
        logsUrl: build.output_stream_url || null,
        updatedAt: new Date()
      }
    }, { merge: true });

    // Build user-specific VS Code extension (VSIX) and upload to R2
    let extensionUrl: string | null = null;
    let extensionR2Key: string | null = null;
    try {
      // Determine a friendly display name for the extension
      let extDisplayName: string = pipelineData?.name || app.name;
      if (mcpId) {
        try {
          const mcpDoc = await db.collection('mcps').doc(mcpId).get();
          const mcpTitle = (mcpDoc.exists ? (mcpDoc.data() as any)?.title : null) as string | null;
          if (mcpTitle && mcpTitle.trim()) {
            extDisplayName = mcpTitle.trim();
          }
        } catch (e) {
          // non-fatal
          console.warn('Could not load MCP title; using pipeline/app name as displayName');
        }
      }
      const vsix = await buildAndUploadVSIX({
        userId: req.userId,
        pipelineId,
        endpoint: app.web_url.replace(/\/$/, ''),
        appName: app.name,
        displayName: extDisplayName
      });
      extensionUrl = vsix.downloadUrl;
      extensionR2Key = vsix.r2Key;
    } catch (e) {
      console.warn('Failed to build/upload VSIX:', e);
    }

    // Update MCP document (top-level) if present
    if (mcpId) {
      try {
        await db.collection('mcps').doc(mcpId).set({
          deploymentUrl: app.web_url,
          deploymentStatus: 'deployed',
          extensionUrl: extensionUrl || null,
          extensionR2Key: extensionR2Key || null,
          logsUrl: build.output_stream_url || null,
          deployedAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
      } catch (e) {
        console.warn('Failed to update MCP doc with deployment info:', e);
      }
    }

    // Also store extension R2 key in pipeline doc for stable download endpoint
    await db.collection('pipelines').doc(pipelineId).set({
      deployment: {
        extensionR2Key: extensionR2Key || null,
        extensionUrl: extensionUrl || null
      }
    }, { merge: true });

    return successResponse({
      message: 'MCP pipeline deployed successfully',
      deploymentId: build.id,
      deployment: {
        appName: app.name,
        appUrl: app.web_url,
        buildId: build.id,
        exportId: exportResult.exportId,
        status: 'deployed',
        deploymentId: build.id,
        provider: 'heroku',
        logsUrl: build.output_stream_url || null,
        extensionUrl,
        extensionR2Key
      }
    });

  } catch (error) {
    console.error('MCP deployment error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Best-effort: mark deployment as failed if a deployment doc was created
    try {
      if (deploymentDocId) {
        const db = await getFirestore();
        await db.collection('deployments').doc(deploymentDocId).set({
          status: 'failed',
          updatedAt: new Date(),
          error: errorMessage
        }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to update Firestore deployment doc with failure state:', e);
    }
    return errorResponse(`Deployment failed: ${errorMessage}`, 500);
  }
});
