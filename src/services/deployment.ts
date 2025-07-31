import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import firebaseInstance from '@/lib/firebase';
import { deployToHeroku, generateHerokuAppName } from '@/lib/heroku';
import config from '@/config';

// Get Firebase services
const db = firebaseInstance.db;

interface DeploymentOptions {
  pipelineId: string;
  userId: string;
  fileId?: string;
  envVars?: Record<string, string>;
}

export interface DeploymentResult {
  success: boolean;
  appId?: string;
  appName?: string;
  webUrl?: string;
  error?: string;
  buildId?: string;
}

export async function deployMcpServer({
  pipelineId,
  userId,
  fileId,
  envVars = {},
}: DeploymentOptions): Promise<DeploymentResult> {
  const deploymentId = `deploy-${uuidv4()}`;
  const deploymentRef = doc(db, 'deployments', deploymentId);
  
  try {
    // Generate a unique app name for Heroku
    const appName = generateHerokuAppName('contexto-mcp');
    
    // Create deployment record in Firestore
    await setDoc(deploymentRef, {
      id: deploymentId,
      pipelineId,
      userId,
      fileId,
      status: 'pending',
      platform: 'heroku',
      appName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Get the pipeline export URL
    const exportUrl = await getPipelineExportUrl(pipelineId, fileId);
    
    // Default environment variables
    const defaultEnvVars = {
      NODE_ENV: 'production',
      PORT: '3000',
      NPM_CONFIG_PRODUCTION: 'false',
      YARN_PRODUCTION: 'false',
      // Add any other default env vars here
    };
    
    // Merge with provided env vars (allowing overrides)
    const combinedEnvVars = {
      ...defaultEnvVars,
      ...envVars,
    };
    
    // Deploy to Heroku
    const deploymentResult = await deployToHeroku({
      appName,
      pipelineId,
      userId,
      envVars: combinedEnvVars
    });

    if (!deploymentResult.success) {
      throw new Error(deploymentResult.error || 'Deployment failed');
    }

    // Ensure we have valid deployment data
    if (!deploymentResult.app || !deploymentResult.build || !deploymentResult.webUrl) {
      throw new Error('Invalid deployment response: missing required fields');
    }

    // Update deployment record with success
    await updateDoc(deploymentRef, {
      status: 'succeeded',
      appId: deploymentResult.app.id,
      appName: deploymentResult.app.name,
      webUrl: deploymentResult.webUrl,
      buildId: deploymentResult.build.id,
      updatedAt: new Date().toISOString(),
    });
    
    return {
      success: true,
      appId: deploymentResult.app.id,
      appName: deploymentResult.app.name,
      webUrl: deploymentResult.webUrl,
      buildId: deploymentResult.build.id,
    };
  } catch (error: any) {
    console.error('Deployment failed:', error);
    
    // Update deployment record with failure
    await updateDoc(deploymentRef, {
      status: 'failed',
      error: error.message,
      updatedAt: new Date().toISOString(),
    });
    
    return {
      success: false,
      error: error.message || 'Failed to deploy MCP server',
    };
  }
}

async function getPipelineExportUrl(pipelineId: string, fileId?: string): Promise<string> {
  if (!fileId) {
    // If no fileId is provided, try to get the latest export for the pipeline
    const pipelineRef = doc(db, 'pipelines', pipelineId);
    const pipelineDoc = await getDoc(pipelineRef);
    
    if (!pipelineDoc.exists()) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    const pipelineData = pipelineDoc.data();
    if (!pipelineData.exportUrl) {
      throw new Error(`No export URL found for pipeline ${pipelineId}`);
    }
    
    return pipelineData.exportUrl;
  }
  
  // If fileId is provided, construct the R2 URL
  if (!config.r2.endpoint) {
    throw new Error('R2 endpoint not configured');
  }
  
  // Ensure the endpoint has a trailing slash
  const baseUrl = config.r2.endpoint.endsWith('/')
    ? config.r2.endpoint
    : `${config.r2.endpoint}/`;
    
  return `${baseUrl}${config.r2.bucketName}/exports/${pipelineId}/${fileId}.zip`;
}

// Helper to generate a unique deployment ID
export function generateDeploymentId(prefix = 'deploy'): string {
  return `${prefix}-${uuidv4()}`;
}
