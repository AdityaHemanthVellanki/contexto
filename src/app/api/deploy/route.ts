import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { deployMcpServer } from '@/services/deployment';
import { z } from 'zod';

// Input validation schema
const DeployRequestSchema = z.object({
  pipelineId: z.string().min(1, 'Pipeline ID is required'),
  fileId: z.string().optional(),
  envVars: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = DeployRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { pipelineId, fileId, envVars = {} } = validation.data;
    const userId = authResult.userId!;

    // Start the deployment
    const result = await deployMcpServer({
      pipelineId,
      fileId,
      userId,
      envVars,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Deployment failed' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      appId: result.appId,
      appName: result.appName,
      webUrl: result.webUrl,
      buildId: result.buildId,
    });
  } catch (error: any) {
    console.error('Deployment error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
