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
  if (!sourceBlobUrl) {
    throw new Error('Missing required sourceBlobUrl');
  }

  // Parse and validate the URL components
  let parsedUrl: URL;
  let finalUrl: string;
  
  try {
    // Ensure URL is properly formatted and force HTTPS
    let normalizedUrl = sourceBlobUrl;
    
    // Add protocol if missing
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    parsedUrl = new URL(normalizedUrl);
    
    // Force HTTPS
    if (parsedUrl.protocol !== 'https:') {
      parsedUrl.protocol = 'https:';
      normalizedUrl = parsedUrl.toString();
    }
    
    finalUrl = normalizedUrl; // Store the final URL
    
    // Log the URL components for debugging
    console.log('[createHerokuBuild] Validating source URL:', {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      fullUrl: finalUrl
    });
    
    // Ensure the URL points to a ZIP file
    if (!parsedUrl.pathname.endsWith('.zip')) {
      console.warn('[createHerokuBuild] Source URL does not end with .zip, this may cause issues');
    }
    
    // Ensure the URL contains the bucket name
    const bucketName = process.env.CF_R2_BUCKET_NAME;
    if (bucketName && !parsedUrl.pathname.includes(bucketName)) {
      console.warn(`[createHerokuBuild] Source URL path does not contain bucket name '${bucketName}'`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[createHerokuBuild] Invalid source URL:', errorMessage, { sourceBlobUrl });
    throw new Error(`Invalid source URL format: ${errorMessage}`);
  }
  
  console.log(`[createHerokuBuild] Creating build for app ${appId} with source: ${finalUrl}`);

  // Prepare the source_blob object
  const sourceBlob: { url: string; version?: string } = {
    url: finalUrl
  };

  // Add version if provided
  if (version) {
    sourceBlob.version = version;
  }

  console.log(`[createHerokuBuild] Creating build for app ${appId} with source URL: ${finalUrl}`);
  
  try {
    const response = await herokuRequest<HerokuBuild>(`/apps/${appId}/builds`, {
      method: 'POST',
      body: JSON.stringify({ source_blob: sourceBlob }),
    });
    
    console.log(`Build created successfully: ${response.id}`);
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Failed to create Heroku build:', error);
    throw new Error(`Failed to create build: ${errorMessage}`);
  }
}

export async function pollHerokuBuild(
  appId: string,
  buildId: string,
  intervalMs = 5000,
  timeoutMs = 15 * 60 * 1000,
  sourceBlobUrl?: string // Optional source URL for better error reporting
): Promise<HerokuBuild> {
  const startTime = Date.now();
  let buildOutput = '';
  let lastStatus = '';

  const buildUrl = `https://dashboard.heroku.com/apps/${appId}/activity/builds/${buildId}`;
  
  // Log the build start with source URL if available
  console.log(`Polling Heroku build ${buildId} for app ${appId}...`);
  if (sourceBlobUrl) {
    console.log(`Source URL: ${sourceBlobUrl}`);
  }

  while (Date.now() - startTime < timeoutMs) {
    const build = await herokuRequest<HerokuBuild>(`/apps/${appId}/builds/${buildId}`);
    
    // Log status changes
    if (build.status !== lastStatus) {
      console.log(`Build status: ${lastStatus} → ${build.status}`);
      lastStatus = build.status;
    }
    
    // Try to get build output if available
    if (build.output_stream_url) {
      try {
        const outputResponse = await fetch(build.output_stream_url);
        if (outputResponse.ok) {
          buildOutput = await outputResponse.text();
          // Log the last few lines of output for debugging
          const lines = buildOutput.split('\n').filter(Boolean);
          if (lines.length > 0) {
            console.log('Latest build output:', lines.slice(-5).join('\n'));
          }
        }
      } catch (error) {
        console.error('Error fetching build output:', error);
      }
    }

    if (build.status === 'succeeded') {
      console.log(`Build ${buildId} completed successfully`);
      return build;
    }

    if (build.status === 'failed' || build.status === 'cancelled') {
      // Try to get more detailed error information from the build output
      let errorDetails = 'No additional error details available';
      
      if (buildOutput) {
        // Look for error patterns in the build output
        const errorMatch = buildOutput.match(/error:?\s+(.*)/i) || [];
        if (errorMatch[1]) {
          errorDetails = errorMatch[1].trim();
        } else {
          // If no specific error message, take the last few lines of output
          const lines = buildOutput.split('\n').filter(Boolean);
          errorDetails = lines.slice(-5).join('\n');
        }
      }
      
      const errorMessage = [
        `❌ Heroku build ${build.status.toUpperCase()}`,
        `Build ID: ${buildId}`,
        `App: ${appId}`,
        `Dashboard: ${buildUrl}`,
        '',
        'SOURCE CONFIGURATION:',
        `Source URL: ${sourceBlobUrl || 'Not provided'}`,
        '',
        'ERROR DETAILS:',
        errorDetails,
        '',
        'FULL BUILD OUTPUT:',
        buildOutput || 'No build output available'
      ].filter(Boolean).join('\n');
      
      console.error(`[pollHerokuBuild] Build failed: ${build.status}`, {
        buildId,
        appId,
        sourceBlobUrl,
        errorDetails: errorDetails.split('\n')[0] // First line of error for logs
      });
      
      throw new Error(errorMessage);
    }

    // Wait for the next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // If we get here, we've timed out
  const errorMessage = [
    `Build timed out after ${timeoutMs / 1000} seconds.`,
    `Build ID: ${buildId}`,
    `Dashboard: ${buildUrl}`,
    sourceBlobUrl ? `Source URL: ${sourceBlobUrl}` : '',
    'Build output:',
    buildOutput || 'No build output available'
  ].filter(Boolean).join('\n');
  
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
  try {
    // 1. Generate the download URL for the pipeline ZIP
    console.log('[deployToHeroku] Generating download URL...');
    const sourceBlobUrl = getPipelineDownloadUrl(userId, pipelineId);
    
    // Validate the download URL format
    if (!/^https:\/\//.test(sourceBlobUrl)) {
      throw new Error(`Invalid download URL format for Heroku build (must start with https://): ${sourceBlobUrl}`);
    }
    
    // Parse the URL to verify all components
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceBlobUrl);
      console.log('[deployToHeroku] Validated download URL:', {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        pathname: parsedUrl.pathname,
        fullUrl: sourceBlobUrl
      });
    } catch (error) {
      console.error('[deployToHeroku] Invalid URL format:', error);
      throw new Error(`Invalid URL format for source blob: ${sourceBlobUrl}`);
    }
    
    // Ensure the path includes the bucket name
    if (!parsedUrl.pathname.includes(process.env.CF_R2_BUCKET_NAME || '')) {
      console.warn('[deployToHeroku] Warning: URL path may be missing bucket name');
    }
    
    // 2. Create a new Heroku app with a unique name based on pipelineId
    console.log(`[deployToHeroku] Creating Heroku app for pipeline: ${pipelineId}`);
    const app = await createHerokuApp(pipelineId);
    console.log(`[deployToHeroku] Created Heroku app: ${app.name} (${app.id})`);
    
    try {
      // 3. Set environment variables
      if (Object.keys(envVars).length > 0) {
        console.log('[deployToHeroku] Configuring environment variables...');
        await configureHerokuApp(app.id, envVars);
      }
      
      // 4. Create and monitor build
      let completedBuild: HerokuBuild;
      try {
        console.log(`[deployToHeroku] Creating Heroku build with source URL: ${sourceBlobUrl}`);
        
        // Final validation of the source URL
        if (!sourceBlobUrl.startsWith('https://')) {
          throw new Error(`FATAL: Invalid source URL format (missing https://): ${sourceBlobUrl}`);
        }
        
        // Ensure the URL contains the bucket name
        const bucketName = process.env.CF_R2_BUCKET_NAME;
        if (bucketName && !sourceBlobUrl.includes(`/${bucketName}/`)) {
          console.warn(`[deployToHeroku] WARNING: Source URL may be missing bucket name '${bucketName}' in path`);
          console.warn(`[deployToHeroku] Expected format: https://<account>.r2.cloudflarestorage.com/${bucketName}/...`);
        }
        
        // Create the build
        const build = await createHerokuBuild({
          appId: app.id,
          sourceBlobUrl,
          version: version || pipelineId
        });
        
        console.log(`[deployToHeroku] Build created, monitoring status. Build ID: ${build.id}`);
        
        // Monitor the build status
        completedBuild = await pollHerokuBuild(
          app.id, 
          build.id,
          5000, // intervalMs
          15 * 60 * 1000, // timeoutMs (15 minutes)
          sourceBlobUrl // Pass source URL for better error reporting
        );
        
        if (completedBuild.status !== 'succeeded') {
          const errorMsg = [
            `❌ Build failed with status: ${completedBuild.status}`,
            `Build ID: ${build.id}`,
            `App: ${app.name} (${app.id})`,
            `Source URL: ${sourceBlobUrl}`,
            `Dashboard: https://dashboard.heroku.com/apps/${app.id}/activity/builds/${build.id}`,
            'Check the Heroku dashboard for detailed build logs.'
          ].join('\n');
          throw new Error(errorMsg);
        }
        
      } catch (error) {
        console.error('[deployToHeroku] Error during build process:', error);
        
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
      
      // 5. Get the web URL
      const webUrl = await getHerokuAppWebUrl(app.id);
      console.log(`Deployment successful! App URL: ${webUrl}`);
      
      return {
        success: true,
        url: webUrl,
        vsixUrl: webUrl ? `${webUrl}/vsix` : undefined,
        app,
        build: completedBuild,
        webUrl
      };
      
    } catch (error) {
      // Log the error and include app info for cleanup
      console.error('Deployment failed:', error);
      console.warn(`App ${app.name} (${app.id}) may need to be cleaned up`);
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
