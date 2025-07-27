/**
 * Git-based Heroku deployment service
 * Uses git push to deploy directly, eliminating URL issues
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Deploy to Heroku using Git push
 * Creates a temp repo, commits the pipeline, and pushes to Heroku
 */
export async function deployToHerokuWithGit(
  appName: string,
  pipelineDir: string,
  pipelineId: string
): Promise<string> {
  console.log('gitDeployService: Starting Git-based Heroku deployment');
  
  const tempDir = await createTempRepo(pipelineDir, pipelineId);
  
  try {
    // Initialize git repo
    await execAsync('git init', { cwd: tempDir });
    
    // Add all files
    await execAsync('git add .', { cwd: tempDir });
    
    // Commit with pipeline ID
    await execAsync(`git commit -m "pipeline: ${pipelineId}"`, { cwd: tempDir });
    
    // Add Heroku remote
    const herokuRemote = `https://git.heroku.com/${appName}.git`;
    await execAsync(`git remote add heroku ${herokuRemote}`, { cwd: tempDir });
    
    // Force push to Heroku
    console.log('gitDeployService: Pushing to Heroku...');
    const { stdout, stderr } = await execAsync('git push -f heroku HEAD:main', { cwd: tempDir });
    
    console.log('gitDeployService: Push successful:', stdout);
    if (stderr) console.log('gitDeployService: Push stderr:', stderr);
    
    // Return the Heroku app URL
    return `https://${appName}.herokuapp.com`;
    
  } finally {
    // Cleanup temp directory
    await cleanupTempRepo(tempDir);
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
  
  console.log('gitDeployService: Created temp repo at', tempDir);
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
    console.log('gitDeployService: Cleaned up temp repo');
  } catch (error) {
    console.warn('gitDeployService: Failed to cleanup temp repo:', error);
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
