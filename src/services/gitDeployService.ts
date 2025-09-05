import { deployToHeroku, generateHerokuAppName } from '@/lib/heroku';

export interface GitDeploymentResult {
  success: boolean;
  appId?: string;
  appName?: string;
  webUrl?: string;
  buildId?: string;
  url?: string;
  vsixUrl?: string;
  error?: string;
}

/**
 * Temporary adapter that performs a Heroku deployment using the existing API-based flow.
 * The route expects a Git-based deploy service, but this adapter uses our
 * proven deployToHeroku implementation underneath for reliability.
 */
export async function deployToHerokuWithGit(
  pipelineId: string,
  userId: string,
  _sourceDir: string
): Promise<GitDeploymentResult> {
  try {
    const appName = generateHerokuAppName('contexto-mcp');

    const result = await deployToHeroku({
      appName,
      pipelineId,
      userId,
      envVars: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      version: pipelineId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Deployment failed',
      };
    }

    return {
      success: true,
      appId: result.app?.id,
      appName: result.app?.name,
      webUrl: result.webUrl,
      buildId: result.build?.id,
      url: result.url,
      vsixUrl: result.vsixUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown deployment error',
    };
  }
}
