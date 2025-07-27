import { NextRequest, NextResponse } from 'next/server';
import { deployToHerokuWithGit } from '@/services/gitDeployService';
import { ensureAuthenticated } from '@/lib/auth';
import { mcpExporter } from '@/lib/mcpExporter';
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
    const { userId } = await ensureAuthenticated(request);
    
    const { pipelineId } = await request.json();
    
    if (!pipelineId) {
      return NextResponse.json(
        { error: 'pipelineId is required' },
        { status: 400 }
      );
    }

    console.log(`deploy-git: Starting Git deployment for pipeline ${pipelineId}`);

    // Step 1: Export the pipeline to a temporary directory
    console.log('deploy-git: Exporting pipeline...');
    const exportResult = await mcpExporter(pipelineId, userId);
    
    if (!exportResult.success) {
      return NextResponse.json(
        { error: exportResult.error || 'Pipeline export failed' },
        { status: 500 }
      );
    }

    // Create temporary directory for pipeline files
    const tempDir = path.join(os.tmpdir(), `pipeline-${pipelineId}-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      // Copy exported files to temp directory
      console.log('deploy-git: Copying exported files...');
      const exportDir = exportResult.exportPath || path.join(tempDir, 'export');
      
      // Copy directory contents
      await copyDirectory(exportDir, tempDir);

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
        mcpUrl: deploymentResult.mcpUrl,
        dashboardUrl: deploymentResult.dashboardUrl,
        logs: deploymentResult.logs
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
