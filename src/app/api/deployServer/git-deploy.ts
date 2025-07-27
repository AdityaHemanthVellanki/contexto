import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Complete Git-based Heroku deployment implementation
 * Uses git push to deploy directly, eliminating all URL issues
 */

export async function deployToHerokuWithGit(
  pipelineId: string,
  userId: string,
  pipelineDir: string
): Promise<{
  success: boolean;
  mcpUrl: string;
  dashboardUrl: string;
  logs: string[];
}> {
  console.log('git-deploy: Starting complete Git-based Heroku deployment');
  
  const appName = `contexto-mcp-${userId}-${pipelineId}`.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 30);
  const logs: string[] = [];
  
  try {
    // Step 1: Ensure Heroku app exists
    logs.push('Creating Heroku app...');
    await ensureHerokuApp(appName, logs);
    
    // Step 2: Create temp git repo and deploy
    logs.push('Creating temporary git repository...');
    const tempDir = await createTempRepo(pipelineDir, pipelineId);
    
    try {
      // Initialize git repo
      logs.push('Initializing git repository...');
      await execAsync('git init', { cwd: tempDir });
      
      // Add all files
      logs.push('Adding files to git...');
      await execAsync('git add .', { cwd: tempDir });
      
      // Commit with pipeline ID
      logs.push('Committing pipeline...');
      await execAsync(`git commit -m "pipeline: ${pipelineId}"`, { cwd: tempDir });
      
      // Add Heroku remote
      const herokuRemote = `https://git.heroku.com/${appName}.git`;
      logs.push(`Adding Heroku remote: ${herokuRemote}`);
      await execAsync(`git remote add heroku ${herokuRemote}`, { cwd: tempDir });
      
      // Force push to Heroku
      logs.push('Pushing to Heroku...');
      const { stdout, stderr } = await execAsync('git push -f heroku HEAD:main', { cwd: tempDir });
      
      logs.push('Push successful!');
      if (stdout) logs.push(stdout);
      if (stderr) logs.push(stderr);
      
      const mcpUrl = `https://${appName}.herokuapp.com`;
      const dashboardUrl = `https://dashboard.heroku.com/apps/${appName}`;
      
      return {
        success: true,
        mcpUrl,
        dashboardUrl,
        logs
      };
      
    } finally {
      // Cleanup temp directory
      await cleanupTempRepo(tempDir);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logs.push(`Deployment failed: ${errorMessage}`);
    
    throw new Error(`Git deployment failed: ${errorMessage}`);
  }
}

/**
 * Ensure Heroku app exists, create if it doesn't
 */
async function ensureHerokuApp(appName: string, logs: string[]): Promise<void> {
  const apiKey = process.env.HEROKU_API_KEY;
  if (!apiKey) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }
  
  try {
    // Check if app exists
    const response = await fetch(`https://api.heroku.com/apps/${appName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.heroku+json; version=3'
      }
    });
    
    if (response.ok) {
      logs.push(`Heroku app ${appName} already exists`);
      return;
    }
    
    if (response.status === 404) {
      // Create the app
      logs.push(`Creating Heroku app: ${appName}`);
      const createResponse = await fetch('https://api.heroku.com/apps', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.heroku+json; version=3'
        },
        body: JSON.stringify({
          name: appName,
          region: process.env.HEROKU_REGION || 'us'
        })
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create Heroku app: ${createResponse.status} ${errorText}`);
      }
      
      logs.push(`Heroku app ${appName} created successfully`);
    } else {
      const errorText = await response.text();
      throw new Error(`Failed to check Heroku app: ${response.status} ${errorText}`);
    }
    
  } catch (error) {
    throw new Error(`Heroku app management failed: ${error}`);
  }
}

/**
 * Create a temporary git repository from pipeline files
 */
async function createTempRepo(pipelineDir: string, pipelineId: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `contexto-pipeline-${pipelineId}-${Date.now()}`);
  
  // Create temp directory
  await fs.promises.mkdir(tempDir, { recursive: true });
  
  // Copy pipeline files to temp directory
  await copyDirectory(pipelineDir, tempDir);
  
  console.log('git-deploy: Created temp repo at', tempDir);
  return tempDir;
}

/**
 * Copy directory contents recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await fs.promises.mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Cleanup temporary repository
 */
async function cleanupTempRepo(tempDir: string): Promise<void> {
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    console.log('git-deploy: Cleaned up temp repo');
  } catch (error) {
    console.warn('git-deploy: Failed to cleanup temp repo:', error);
  }
}

/**
 * Check if Git is available
 */
export async function checkGitAvailability(): Promise<boolean> {
  try {
    await execAsync('git --version');
    return true;
  } catch {
    return false;
  }
}
