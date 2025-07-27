import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { r2, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';

// Initialize Firebase Admin
const adminDb = initializeFirebaseAdmin();

// Schema for deployment request
const DeployServerSchema = z.object({
  pipelineId: z.string(),
  fileId: z.string().optional(),
});

// Heroku deployment file structure
interface HerokuFile {
  file: string;
  data: string;
}





// Helper function to ensure Heroku app exists
async function ensureHerokuApp(appName: string): Promise<{ id: string; name: string }> {
  const herokuApiKey = process.env.HEROKU_API_KEY;
  if (!herokuApiKey) {
    throw new Error('HEROKU_API_KEY environment variable is not set');
  }

  try {
    // Try to get existing app
    const response = await fetch(`https://api.heroku.com/apps/${appName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${herokuApiKey}`,
        'Accept': 'application/vnd.heroku+json; version=3',
      },
    });

    if (response.ok) {
      const app = await response.json();
      return { id: app.id, name: app.name };
    }

    // Create new app if it doesn't exist
    const createResponse = await fetch('https://api.heroku.com/apps', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${herokuApiKey}`,
        'Accept': 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: appName,
        region: process.env.HEROKU_REGION || 'us',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create Heroku app: ${error}`);
    }

    const app = await createResponse.json();
    return { id: app.id, name: app.name };

  } catch (error) {
    console.error('Heroku app creation error:', error);
    throw error;
  }
}

// Helper function to verify Heroku release
async function verifyHerokuRelease(appId: string): Promise<boolean> {
  const herokuApiKey = process.env.HEROKU_API_KEY;
  if (!herokuApiKey) {
    throw new Error('HEROKU_API_KEY environment variable is not set');
  }

  try {
    const response = await fetch(`https://api.heroku.com/apps/${appId}/releases`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${herokuApiKey}`,
        'Accept': 'application/vnd.heroku+json; version=3',
      },
    });

    if (!response.ok) {
      return false;
    }

    const releases = await response.json();
    const latestRelease = releases[0];
    return latestRelease && latestRelease.status === 'succeeded';

  } catch (error) {
    console.error('Heroku release verification error:', error);
    return false;
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

// Helper function to generate VS Code extension
async function generateVSCodeExtension(pipelineId: string, mcpUrl: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `vscode-extension-${pipelineId}-`));
  
  try {
    // Create extension directory structure
    await mkdir(path.join(tempDir, 'src'), { recursive: true });

    // Create package.json
    const packageJson = {
      name: `contexto-mcp-${pipelineId}`,
      displayName: 'Contexto MCP Client',
      description: 'VS Code extension for Contexto MCP server',
      version: '1.0.0',
      publisher: 'contexto',
      engines: { vscode: '^1.74.0' },
      categories: ['Other'],
      activationEvents: ['onStartupFinished'],
      main: './out/extension.js',
      contributes: {
        commands: [{
          command: 'contexto.askMCP',
          title: 'Ask MCP'
        }],
        configuration: {
          title: 'Contexto MCP',
          properties: {
            'contexto.mcpEndpoint': {
              type: 'string',
              default: mcpUrl,
              description: 'MCP server endpoint'
            }
          }
        }
      },
      scripts: {
        vscode: 'prebuild',
        prebuild: 'npm run clean && npm run compile',
        compile: 'tsc -p ./',
        clean: 'rimraf out'
      },
      devDependencies: {
        '@types/vscode': '^1.74.0',
        '@types/node': '16.x',
        typescript: '^4.9.4',
        rimraf: '^3.0.2'
      }
    };

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create extension.ts
    const extensionTs = `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const askMCPCommand = vscode.commands.registerCommand('contexto.askMCP', async () => {
    const config = vscode.workspace.getConfiguration('contexto');
    const endpoint = config.get('mcpEndpoint', '${mcpUrl}');
    
    const question = await vscode.window.showInputBox({
      prompt: 'Enter your question for the MCP server'
    });
    
    if (!question) {
      return;
    }
    
    try {
      const response = await fetch(\`\${endpoint}/query\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: question })
      });
      
      const data = await response.json();
      
      if (data.answer) {
        const doc = await vscode.workspace.openTextDocument({
          content: data.answer,
          language: 'markdown'
        });
        vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showErrorMessage('No response received from MCP server');
      }
    } catch (error) {
      vscode.window.showErrorMessage('Error: ' + error);
    }
  });
  
  context.subscriptions.push(askMCPCommand);
}

export function deactivate() {}`;

    await writeFile(
      path.join(tempDir, 'src', 'extension.ts'),
      extensionTs
    );

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        module: 'commonjs',
        target: 'es2020',
        outDir: 'out',
        lib: ['es2020'],
        sourceMap: true,
        rootDir: 'src',
        strict: true
      },
      exclude: ['node_modules', '.vscode-test']
    };

    await writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Install dependencies and build
    execSync('npm install', { cwd: tempDir });
    execSync('npm run compile', { cwd: tempDir });

    // Package extension
    execSync('npm install -g vsce', { cwd: tempDir });
    execSync(`vsce package --out ${pipelineId}.vsix`, { cwd: tempDir });

    // Upload to R2
    const vsixPath = path.join(tempDir, `${pipelineId}.vsix`);
    const vsixBuffer = await readFile(vsixPath);
    
    const key = `vsixs/${pipelineId}.vsix`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: vsixBuffer,
      ContentType: 'application/octet-stream'
    }));

    const vsixUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return vsixUrl;

  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before deploying more servers.' },
        { status: 429 }
      );
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.userId;

    // Parse request body
    const body = await request.json();
    const validation = DeployServerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { pipelineId, fileId } = validation.data;

    console.log(`Starting MCP server deployment for pipeline ${pipelineId} by user ${userId}`);

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

    // Get vector store configuration from pipeline
    const vectorStoreEndpoint = pipelineData.vectorStore?.endpoint || '';
    const storeType = pipelineData.vectorStore?.type || 'firestore';

    if (!vectorStoreEndpoint) {
      return NextResponse.json({ 
        error: 'Vector store endpoint not configured' 
      }, { status: 400 });
    }

    // Read the vectorStoreClient.js template
    let vectorStoreClientTemplate;
    try {
      vectorStoreClientTemplate = await readFile(
        path.join(process.cwd(), 'src/templates/vectorStoreClient.js'), 
        'utf-8'
      );
      console.log('Successfully loaded vectorStoreClient.js template');
    } catch (error) {
      console.error('Failed to read vectorStoreClient.js template:', error);
      return NextResponse.json({ error: 'Failed to prepare deployment files' }, { status: 500 });
    }

    // Export the pipeline first
    const exportResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/exportMCP`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pipelineId })
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.text();
      throw new Error(`Failed to export pipeline: ${error}`);
    }

    const exportData = await exportResponse.json();
    const downloadUrl = exportData.downloadUrl;

    // Create temp directory for Git-based deployment
    const tempDir = await mkdtemp(path.join(os.tmpdir(), `pipeline-${pipelineId}-`));
    
    try {
      console.log('Downloading and extracting pipeline...');
      
      // Download ZIP file
      const zipResponse = await fetch(downloadUrl);
      if (!zipResponse.ok) {
        throw new Error(`Failed to download pipeline: ${zipResponse.statusText}`);
      }
      
      const zipBuffer = await zipResponse.arrayBuffer();
      await writeFile(path.join(tempDir, 'pipeline.zip'), Buffer.from(zipBuffer));

      // Extract ZIP using unzip command
      execSync(`unzip -o ${path.join(tempDir, 'pipeline.zip')} -d ${tempDir}`, { 
        stdio: 'inherit' 
      });
      
      // Remove ZIP file
      await rm(path.join(tempDir, 'pipeline.zip'), { force: true });

      // Initialize Git repository
      console.log('Initializing Git repository...');
      execSync('git init', { cwd: tempDir });
      execSync('git config user.email "deploy@contexto.app"', { cwd: tempDir });
      execSync('git config user.name "Contexto Deploy"', { cwd: tempDir });
      execSync('git add .', { cwd: tempDir });
      execSync(`git commit -m "Deploy pipeline: ${pipelineId}"`, { cwd: tempDir });

      // Ensure Heroku app exists
      const appName = `contexto-mcp-${pipelineId}`.toLowerCase();
      console.log('Ensuring Heroku app exists...');
      const app = await ensureHerokuApp(appName);

      // Push to Heroku
      console.log('Pushing to Heroku...');
      execSync(`git remote add heroku https://git.heroku.com/${app.name}.git`, { cwd: tempDir });
      execSync('git push -f heroku HEAD:main', { cwd: tempDir, stdio: 'inherit' });

      // Verify release
      console.log('Verifying Heroku release...');
      const releaseVerified = await verifyHerokuRelease(app.id);
      if (!releaseVerified) {
        throw new Error('Heroku release verification failed');
      }

      const mcpUrl = `https://${app.name}.herokuapp.com`;

      // Generate VS Code extension
      console.log('Generating VS Code extension...');
      const vsixUrl = await generateVSCodeExtension(pipelineId, mcpUrl);

      // Log deployment to Firestore
      await adminDb.collection('deployments').add({
        pipelineId,
        userId,
        appId: app.id,
        appName: app.name,
        mcpUrl,
        vsixUrl,
        status: 'deployed',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        appUrl: mcpUrl,
        appId: app.id,
        vsixUrl,
        verification: { verified: true, message: 'Heroku deployment successful' }
      });

    } finally {
      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true });
    }
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
