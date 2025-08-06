import { z } from 'zod';
import crypto from 'crypto';
import config from '@/config';
import { getPipelineDownloadUrl } from './r2';

/**
 * Generates a random URL-safe string of specified length
 * @param length Length of the random string to generate (default: 6)
 * @returns A random string containing lowercase letters and numbers
 */
function randomSuffix(length = 6): string {
  return crypto.randomBytes(Math.ceil(length * 3 / 4))
    .toString('base64')
    .replace(/[^a-z0-9]/g, '')
    .toLowerCase()
    .slice(0, length);
}

/**
 * Generates a unique Heroku app name based on the input string
 * @param baseName The base name to use for the app
 * @returns A unique app name that follows Heroku's naming rules
 */
function generateUniqueAppName(baseName: string): string {
  // 1) Start with sanitized base name
  const sanitized = sanitizeAppName(baseName);
  
  // 2) Append a hyphen + random suffix (4 chars for uniqueness)
  const suffix = randomSuffix(4);
  
  // 3) Compose full name with prefix
  const prefix = 'ctx-mcp-';
  let appName = `${prefix}${sanitized}-${suffix}`;
  
  // 4) Enforce Heroku's 30-char limit
  const maxLength = 30;
  if (appName.length > maxLength) {
    // Leave room for suffix and dash
    const allowed = maxLength - (prefix.length + 1 + suffix.length);
    if (allowed > 0) {
      appName = `${prefix}${sanitized.slice(0, allowed)}-${suffix}`;
    } else {
      // If even the prefix + suffix is too long, use just the suffix
      appName = `ctx-${suffix}`;
    }
  }
  
  // Final validation
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(appName)) {
    throw new Error(`Generated invalid Heroku app name: ${appName}`);
  }
  
  return appName;
}

export interface HerokuApp {
  id: string;
  name: string;
  web_url: string;
  git_url: string;
}

export interface HerokuBuild {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  output_stream_url?: string;
  release?: {
    id: string;
    version: number;
  };
  error?: string;
}

export interface HerokuRelease {
  id: string;
  version: number;
  status: 'succeeded' | 'failed' | 'pending';
  current: boolean;
  slug?: {
    id: string;
  };
}

const HEROKU_API_BASE = 'https://api.heroku.com';

/**
 * Sanitize a raw identifier into a valid Heroku app name:
 * - Lowercase
 * - Only a–z, 0–9, and hyphens
 * - No leading or trailing hyphens
 * - Must start with a letter; prefix with "a" if needed
 * - Must end with a letter or digit; append "0" if needed
 */
export function sanitizeAppName(raw: string): string {
  // 1) Lowercase and replace invalid chars with hyphens
  let name = raw.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  // 2) Collapse multiple hyphens
  name = name.replace(/-+/g, '-');
  
  // 3) Trim leading/trailing hyphens
  name = name.replace(/^-+/, '').replace(/-+$/, '');
  
  // 4) Ensure at least one character
  if (name.length === 0) {
    name = 'contexto';
  }
  
  // 5) Ensure starts with a letter
  if (!/^[a-z]/.test(name)) {
    name = `a${name}`;
  }
  
  // 6) Ensure ends with letter or digit
  if (!/[a-z0-9]$/.test(name)) {
    name = `${name}0`;
  }
  
  // 7) Prepend our prefix and enforce max length (Heroku limit ~30 chars)
  const prefix = 'contexto-mcp-';
  const maxLen = 30;
  let finalName = `${prefix}${name}`;
  if (finalName.length > maxLen) {
    // truncate the sanitized part to fit
    const allowed = maxLen - prefix.length;
    finalName = `${prefix}${name.slice(0, Math.max(0, allowed))}`;
  }
  
  return finalName;
}

async function herokuRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${HEROKU_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.heroku+json; version=3',
      'Authorization': `Bearer ${config.heroku.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Heroku API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
    );
  }

  return response.json();
}

/**
 * Creates a new Heroku app with a unique name based on the provided base name
 * @param baseName The base name to use for the app
 * @returns A promise that resolves to the created Heroku app
 */
export async function createHerokuApp(baseName: string): Promise<HerokuApp> {
  const maxAttempts = 3;
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    // Generate a unique app name for this attempt
    const appName = generateUniqueAppName(baseName);
    console.log(`Attempt ${attempt + 1}/${maxAttempts}: Creating Heroku app with name: ${appName}`);
    
    const body: any = {
      name: appName,
      region: config.heroku.region,
    };

    if (config.heroku.team) {
      body.team = config.heroku.team;
    }

    try {
      const app = await herokuRequest<HerokuApp>('/apps', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      
      console.log(`Successfully created Heroku app: ${app.name}`);
      return app;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If the name is taken, try again with a new name
      if (errorMessage.includes('Name is already taken')) {
        console.warn(`App name ${appName} is already taken, retrying...`);
        attempt++;
        continue;
      }
      
      // For other errors, rethrow
      console.error('Failed to create Heroku app:', error);
      throw new Error(`Failed to create Heroku app: ${errorMessage}`);
    }
  }
  
  throw new Error(`Failed to create a unique Heroku app name after ${maxAttempts} attempts`);
}

interface CreateHerokuBuildOptions {
  appId: string;
  sourceBlobUrl: string;
  version?: string;
}

export async function createHerokuBuild({
  appId,
  sourceBlobUrl,
  version
}: CreateHerokuBuildOptions): Promise<HerokuBuild> {
  // Validate the source URL
  if (typeof sourceBlobUrl !== 'string' || !sourceBlobUrl) {
    throw new Error('Invalid sourceBlobUrl: must be a non-empty string');
  }
  
  // Ensure the URL is HTTPS
  if (!sourceBlobUrl.startsWith('https://')) {
    throw new Error('Invalid source URL: must use HTTPS protocol');
  }
  
  // Log the URL for debugging (full URL in non-production)
  if (process.env.NODE_ENV === 'production') {
    const urlObj = new URL(sourceBlobUrl);
    console.log('[createHerokuBuild] Creating build with source:', {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      hasQueryParams: urlObj.search ? true : false,
      queryParamsLength: urlObj.search ? urlObj.search.length : 0
    });
  } else {
    console.log(`[createHerokuBuild] Creating build with source: ${sourceBlobUrl}`);
  }
  
  // Ensure the URL points to a ZIP file
  if (!sourceBlobUrl.toLowerCase().endsWith('.zip')) {
    console.warn('[createHerokuBuild] Warning: Source URL does not end with .zip');
  }
  
  // Log bucket name presence for debugging (but don't expose the actual bucket name in logs)
  const bucketName = process.env.CF_R2_BUCKET_NAME;
  if (bucketName && !sourceBlobUrl.includes(bucketName)) {
    console.warn('[createHerokuBuild] Warning: Source URL path does not contain expected bucket name');
  }
  
  try {
    // Create the build with the presigned URL
    const build = await herokuRequest<HerokuBuild>(`/apps/${appId}/builds`, {
      method: 'POST',
      body: JSON.stringify({
        source_blob: {
          url: sourceBlobUrl, // Pass the presigned URL directly
          version: version || '1.0.0'
        }
      })
    });

    console.log(`[createHerokuBuild] Build created: ${build.id} (status: ${build.status})`);
    return build;
  } catch (error) {
    // Create a safe log object without exposing sensitive URL parameters
    const logData: Record<string, any> = { 
      error: error instanceof Error ? error.message : 'Unknown error',
      appId,
      buildError: true
    };
    
    try {
      const urlObj = new URL(sourceBlobUrl);
      logData.sourceHost = urlObj.hostname;
      logData.sourcePath = urlObj.pathname;
      logData.hasQueryParams = !!urlObj.search;
    } catch (e) {
      logData.sourceUrl = '[invalid-url]';
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[createHerokuBuild] Error creating build:', { ...logData, errorMessage });
    
    // Include more details in the error message for common issues
    let userFacingError = 'Failed to create build';
    if (errorMessage.includes('404')) {
      userFacingError = 'Source file not found. The presigned URL may have expired.';
    } else if (errorMessage.includes('403')) {
      userFacingError = 'Access denied to source file. The presigned URL may be invalid or expired.';
    } else if (errorMessage.includes('timed out')) {
      userFacingError = 'The request timed out. Please try again.';
    } else if (errorMessage.includes('ENOTFOUND')) {
      userFacingError = 'Could not resolve the source URL. Please check your network connection.';
    }
    
    throw new Error(userFacingError);
  }
}

export async function pollHerokuBuild(
  appId: string,
  buildId: string,
  intervalMs = 5000,
  timeoutMs = 15 * 60 * 1000, // 15 minutes
  sourceBlobUrl?: string // Optional source URL for better error reporting
): Promise<HerokuBuild> {
  const startTime = Date.now();
  let lastStatus = '';
  let buildOutput = '';
  let attempt = 0;
  const maxAttempts = Math.ceil(timeoutMs / intervalMs);
  let sourceUrl: URL | null = null;
  
  try {
    sourceUrl = sourceBlobUrl ? new URL(sourceBlobUrl) : null;
  } catch (error) {
    console.warn('[pollHerokuBuild] Invalid source URL provided:', error);
  }

  // Log build polling start with safe URL information
  const logInfo: Record<string, any> = {
    maxAttempts,
    intervalMs,
    buildId,
    appId,
    sourceHost: sourceUrl?.hostname || 'none',
    sourcePath: sourceUrl?.pathname || 'none',
    hasQueryParams: sourceUrl?.search ? true : false
  };
  
  console.log('[pollHerokuBuild] Starting build polling:', logInfo);

  try {
    while (attempt < maxAttempts) {
      attempt++;
      const attemptStart = Date.now();
      
      try {
        const build = await herokuRequest<HerokuBuild>(`/apps/${appId}/builds/${buildId}`);
        
        // Log status changes with timing information
        if (build.status !== lastStatus) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`[pollHerokuBuild] Build ${buildId} status: ${lastStatus || 'initial'} -> ${build.status} (${elapsed}s)`);
          lastStatus = build.status;
        }

        // If build is done (not pending), return the result or throw an error
        if (build.status !== 'pending') {
          if (build.status === 'succeeded') {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`[pollHerokuBuild] Build ${buildId} completed successfully in ${elapsed}s`);
            return build;
          } else {
            // Build failed or was cancelled
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.error(`[pollHerokuBuild] Build ${buildId} failed after ${elapsed}s with status: ${build.status}`);
            
            // Try to get more detailed error information
            if (build.output_stream_url) {
              try {
                console.log(`[pollHerokuBuild] Fetching build output from: ${build.output_stream_url}`);
                const response = await fetch(build.output_stream_url);
                if (response.ok) {
                  buildOutput = await response.text();
                  // Truncate very large outputs
                  const maxOutputLength = 2000;
                  const truncatedOutput = buildOutput.length > maxOutputLength 
                    ? buildOutput.substring(0, maxOutputLength) + '... [truncated]' 
                    : buildOutput;
                  
                  console.error(`[pollHerokuBuild] Build output (${buildOutput.length} chars):\n${truncatedOutput}`);
                } else {
                  console.error(`[pollHerokuBuild] Failed to fetch build output: ${response.status} ${response.statusText}`);
                }
              } catch (error) {
                console.error('[pollHerokuBuild] Error fetching build output:', error);
              }
            } else {
              console.log('[pollHerokuBuild] No build output URL available');
            }
            
            const dashboardUrl = `https://dashboard.heroku.com/apps/${appId}/activity/builds/${buildId}`;
            
            // Create a detailed error message with troubleshooting info
            const errorDetails: Record<string, string> = {
              'Build Status': build.status,
              'Build ID': buildId,
              'App ID': appId,
              'Elapsed Time': `${elapsed}s`,
              'Dashboard': dashboardUrl
            };
            
            if (sourceUrl) {
              errorDetails['Source Path'] = sourceUrl.pathname;
              errorDetails['Source Host'] = sourceUrl.hostname;
            }
            
            // Get the last 100 lines of build output for the error message
            const lastOutputLines = buildOutput 
              ? buildOutput.split('\n').slice(-100).join('\n')
              : 'No build output available';
            
            // Format the error message with troubleshooting guidance
            const errorMessage = [
              '🚨 Build failed with the following details:',
              ...Object.entries(errorDetails).map(([key, value]) => `• ${key}: ${value}`),
              '',
              '🔍 Troubleshooting tips:',
              '• Check if the presigned URL is still valid (they expire after 1 hour)',
              '• Verify the source file exists in the storage bucket',
              '• Ensure the Heroku app has network access to your storage service',
              '• Check the build logs in the Heroku dashboard for more details',
              '',
              'Last 100 lines of build output:',
              '```',
              lastOutputLines,
              '```',
              `🔗 View full logs: ${dashboardUrl}`
            ].join('\n');
            
            // Enhance error with additional context for common issues
            let enhancedError = new Error(errorMessage);
            const lowerOutput = lastOutputLines.toLowerCase();
            
            if (lowerOutput.includes('404') || lowerOutput.includes('not found')) {
              enhancedError = new Error('Source file not found. The presigned URL may have expired or the file was deleted.');
            } else if (lowerOutput.includes('403') || lowerOutput.includes('forbidden') || lowerOutput.includes('access denied')) {
              enhancedError = new Error('Access denied to source file. The presigned URL may be invalid or expired.');
            } else if (lowerOutput.includes('timeout') || lowerOutput.includes('timed out')) {
              enhancedError = new Error('The build timed out while accessing the source file. Please try again.');
            } else if (lowerOutput.includes('certificate') || lowerOutput.includes('ssl')) {
              enhancedError = new Error('SSL certificate verification failed. Please check your storage service configuration.');
            }
            
            // Preserve the original error details
            (enhancedError as any).originalError = errorMessage;
            throw enhancedError;
          }
        }
      } finally {
        // Wait for the next poll, even if there was an error
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
  } catch (error) {
    // Log the error and rethrow it to be handled by the caller
    console.error(`[pollHerokuBuild] Error polling build ${buildId}:`, error);
    throw error;
  }

  // If we get here, we've timed out
  const dashboardUrl = `https://dashboard.heroku.com/apps/${appId}/activity/builds/${buildId}`;
  const sourceUrlObj = sourceBlobUrl ? new URL(sourceBlobUrl) : null;
  
  const errorDetails: Record<string, string> = {
    'Build Status': 'timeout',
    'Build ID': buildId,
    'App ID': appId,
    'Elapsed Time': `${timeoutMs / 1000}s`,
    'Dashboard': dashboardUrl
  };
  
  if (sourceUrlObj) {
    errorDetails['Source Path'] = sourceUrlObj.pathname;
    errorDetails['Source Host'] = sourceUrlObj.hostname;
  }
  
  const errorMessage = [
    'Build timed out with the following details:',
    ...Object.entries(errorDetails).map(([key, value]) => `• ${key}: ${value}`),
    '',
    'Last 100 lines of build output:',
    buildOutput ? buildOutput.split('\n').slice(-100).join('\n') : 'No build output available'
  ].join('\n');
  
  console.error(`[pollHerokuBuild] Build timed out after ${timeoutMs / 1000}s`, {
    buildId,
    appId,
    dashboardUrl,
    hasSourceUrl: !!sourceBlobUrl
  });
  
  throw new Error(errorMessage);
}

export async function getHerokuAppWebUrl(appId: string): Promise<string> {
  const app = await herokuRequest<{ web_url: string }>(`/apps/${appId}`);
  return app.web_url;
}

export async function configureHerokuApp(
  appId: string,
  envVars: Record<string, string>
): Promise<void> {
  await herokuRequest(`/apps/${appId}/config-vars`, {
    method: 'PATCH',
    body: JSON.stringify(envVars),
  });
}

interface DeployToHerokuOptions {
  appName: string;
  pipelineId: string;
  userId: string;
  envVars?: Record<string, string>;
  version?: string;
}

export async function deployToHeroku({
  appName,
  pipelineId,
  userId,
  envVars = {},
  version
}: DeployToHerokuOptions): Promise<{ 
  success: boolean; 
  url?: string; 
  vsixUrl?: string;
  error?: string;
  app?: HerokuApp;
  build?: HerokuBuild;
  webUrl?: string;
}> {
  // 1. Generate a direct download URL using the Cloudflare Worker
  const workerBaseUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://contexto-r2-proxy.your-account.workers.dev';
  const workerUrl = `${workerBaseUrl}/exports/${userId}/${pipelineId}/mcp-pipeline.zip`;
  console.log('[deployToHeroku] Using Cloudflare Worker URL:', workerUrl);
  
  try {
    // Basic URL validation
    if (!workerUrl.startsWith('https://')) {
      throw new Error(`Invalid worker URL: ${workerUrl}. Set CLOUDFLARE_WORKER_URL environment variable.`);
    }
    
    // Store the URL in a variable with a clear name
    const sourceBlobUrl = workerUrl;

    // 2. Create a new Heroku app
    console.log('[deployToHeroku] Creating Heroku app...');
    const app = await createHerokuApp(appName);
    console.log(`[deployToHeroku] Created Heroku app: ${app.name} (${app.id})`);

    try {
      // 3. Configure environment variables
      if (Object.keys(envVars).length > 0) {
        console.log('[deployToHeroku] Configuring environment variables...');
        await configureHerokuApp(app.id, envVars);
        console.log('[deployToHeroku] Environment variables configured');
      }

      // 4. Create a build using the presigned URL
      console.log('[deployToHeroku] Creating build from source...');
      
      // Log the URL being used (redacted in production)
      console.log(`[deployToHeroku] Using source URL: ${sourceBlobUrl}`);
      
      // Create the build with the exact presigned URL string
      const build = await herokuRequest<HerokuBuild>(`/apps/${app.id}/builds`, {
        method: 'POST',
        body: JSON.stringify({
          source_blob: {
            url: sourceBlobUrl,
            version: version || pipelineId
          }
        })
      });
      
      console.log(`[deployToHeroku] Build created with ID: ${build.id}`);
      
      console.log(`[deployToHeroku] Build created with ID: ${build.id}`);
      
      // 5. Monitor the build status
      console.log(`[deployToHeroku] Monitoring build status for build ${build.id}...`);
      const completedBuild = await pollHerokuBuild(
        app.id,
        build.id,
        5000, // 5 second polling interval
        15 * 60 * 1000, // 15 minute timeout
        sourceBlobUrl // Pass the URL for error reporting
      );

      if (build.status === 'failed' || build.status === 'cancelled') {
        let errorDetails = `Heroku build ${build.status}: ${build.id}\n`;
        errorDetails += `App: ${app.id}\n`;
        errorDetails += `Dashboard: https://dashboard.heroku.com/apps/${app.id}/activity/builds/${build.id}\n\n`;
        
        // Add source URL details
        errorDetails += 'Source URL details:\n';
        if (sourceBlobUrl) {
          try {
            const url = new URL(sourceBlobUrl);
            errorDetails += `- URL: ${url.protocol}//${url.hostname}${url.pathname}\n`;
            errorDetails += `- Has query params: ${!!url.search}\n`;
            errorDetails += `- Expires: 1 hour from generation time\n`;
          } catch (e) {
            errorDetails += `- Invalid URL format\n`;
          }
        } else {
          errorDetails += '- No source URL provided\n';
        }
        
        // Add troubleshooting steps
        errorDetails += '\nTroubleshooting steps:\n';
        errorDetails += '1. Verify the URL is accessible (run: curl -I "<url>")\n';
        errorDetails += '2. Check if the presigned URL is still valid (expires in 1 hour)\n';
        errorDetails += '3. Review Heroku build logs for detailed error messages\n';
        errorDetails += '4. Ensure the R2 bucket and file permissions are correct\n';
        
        // Add the original error if available
        if (build.error) {
          errorDetails += `\nOriginal error: ${build.error}\n`;
        }
        
        throw new Error(errorDetails);
      }

      // 6. Get the app URL
      const webUrl = await getHerokuAppWebUrl(app.id);
      console.log(`[deployToHeroku] Deployment successful! App URL: ${webUrl}`);

      return {
        success: true,
        url: webUrl,
        vsixUrl: webUrl ? `${webUrl}/vsix` : undefined,
        app,
        build: completedBuild,
        webUrl
      };
    } catch (error) {
      // If we have an app but something failed, clean it up
      if (app) {
        console.error(`[deployToHeroku] Error during deployment, cleaning up app ${app.id}...`);
        try {
          await deleteHerokuApp(app.id);
          console.log(`[deployToHeroku] Cleaned up app ${app.id}`);
        } catch (cleanupError) {
          console.error(`[deployToHeroku] Failed to clean up app ${app.id}:`, cleanupError);
        }
      }
      
      // Provide more helpful error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('Unable to fetch source from:')) {
          throw new Error(
            `❌ Heroku failed to download the source file.\n` +
            `This usually happens when the URL is not publicly accessible or the path is incorrect.\n` +
            `URL used: ${sourceBlobUrl}\n` +
            `Make sure the URL is correct and the file is publicly accessible.`
          );
        }
        
        if (error.message.includes('404 Not Found')) {
          throw new Error(
            `❌ The source file was not found at the specified URL.\n` +
            `URL: ${sourceBlobUrl}\n` +
            `Please verify the file exists and the URL is correct.`
          );
        }
        
        // Re-throw the error with additional context
        throw new Error(`Deployment failed: ${error.message}`);
      }
      
      // Re-throw the original error if we don't have a specific handler
      throw error;
    }
  } catch (error) {
    console.error('Error in deployToHeroku:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during deployment'
    };
  }
}

export async function deleteHerokuApp(appId: string): Promise<void> {
  try {
    await herokuRequest(`/apps/${appId}`, {
      method: 'DELETE',
    });
  } catch (error: any) {
    if (!error.message.includes('Couldn\'t find that app')) {
      throw error;
    }
    // App doesn't exist, which is fine for our purposes
  }
}

// Helper to generate a valid Heroku app name
export function generateHerokuAppName(prefix = 'contexto'): string {
  // Ensure the prefix is valid (lowercase alphanumeric, no spaces)
  const safePrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 20); // Leave room for random suffix
    
  // Add a random suffix to ensure uniqueness
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  // Ensure total length is <= 30 characters (Heroku limit)
  return `${safePrefix}-${randomSuffix}`.substring(0, 30);
}
