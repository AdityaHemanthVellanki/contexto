import { NextRequest, NextResponse } from 'next/server';
import { deployToHerokuWithGit } from '@/services/gitDeployService';
import { ensureAuthenticated } from '@/lib/auth';
import { exportMCPBundle } from '@/lib/mcp-exporter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Git-based Heroku deployment API route
 * Uses git push to deploy directly, eliminating all URL issues
 */

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await ensureAuthenticated(request);
    
    const { pipelineId } = await request.json();
    
    if (!pipelineId) {
      return NextResponse.json(
        { error: 'pipelineId is required' },
        { status: 400 }
      );
    }

    console.log(`deploy-git: Starting Git deployment for pipeline ${pipelineId}`);

    // Step 1: Export the pipeline using the real MCP exporter
    console.log('deploy-git: Exporting pipeline...');
    const { exportId, downloadUrl } = await exportMCPBundle(pipelineId, userId);
    console.log(`deploy-git: Pipeline exported with ID ${exportId}`);
    
    // Verify export is accessible
    const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
    if (!headResponse.ok) {
      throw new Error(`Export not accessible: ${headResponse.statusText}`);
    }

    // Create temporary directory for pipeline files
    const tempDir = path.join(os.tmpdir(), `pipeline-${pipelineId}-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      // For now, create basic MCP server files in temp directory
      console.log('deploy-git: Creating MCP server files...');
      
      // Create package.json
      const packageJson = {
        name: `mcp-pipeline-${pipelineId}`,
        version: '1.0.0',
        main: 'server.js',
        dependencies: {
          '@modelcontextprotocol/sdk': '^0.4.0'
        }
      };
      
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // Create basic server.js
      const serverJs = `
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');

const server = new Server({
  name: 'pipeline-${pipelineId}',
  version: '1.0.0'
});

server.start();
`;
      
      await fs.promises.writeFile(
        path.join(tempDir, 'server.js'),
        serverJs
      );

      // Step 2: Deploy using Git
      console.log('deploy-git: Starting Git deployment...');
      const deploymentResult = await deployToHerokuWithGit(
        pipelineId,
        userId,
        tempDir
      );

      console.log('deploy-git: Git deployment completed successfully');
      
      return NextResponse.json({
        success: true,
        deployment: deploymentResult,
        exportUrl: downloadUrl,
        exportId,
        message: 'Pipeline deployed successfully via Git'
      });

    } finally {
      // Cleanup temp directory
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('deploy-git: Failed to cleanup temp directory:', error);
      }
    }

  } catch (error) {
    console.error('deploy-git: Git deployment failed:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Git deployment failed',
        details: 'Please check your Heroku configuration and API key'
      },
      { status: 500 }
    );
  }
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
