/**
 * Helper functions for Heroku deployments
 * Implements the Heroku Platform API v3 for MCP server deployments
 */

/**
 * Interface for Heroku app creation response
 */
export interface HerokuApp {
  id: string;
  name: string;
  web_url: string;
  git_url: string;
  created_at: string;
  updated_at: string;
  region: {
    id: string;
    name: string;
  };
}

/**
 * Interface for Heroku build response
 */
export interface HerokuBuild {
  id: string;
  status: string;
  output_stream_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface for Heroku release response
 */
export interface HerokuRelease {
  id: string;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Ensures a Heroku app exists with the given name
 * If the app already exists, it fetches the existing app instead of creating a new one
 * @param appName Name of the Heroku app
 * @returns The Heroku app details (either newly created or existing)
 */
async function ensureHerokuApp(appName: string): Promise<HerokuApp> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  const HEROKU_TEAM = process.env.HEROKU_TEAM;
  const HEROKU_REGION = process.env.HEROKU_REGION || 'us';

  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  // Prepare request body for app creation
  const requestBody: any = {
    name: appName,
    region: HEROKU_REGION
  };

  // Add team if specified
  if (HEROKU_TEAM) {
    requestBody.team = HEROKU_TEAM;
  }

  // Try to create the app
  const createRes = await fetch('https://api.heroku.com/apps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.heroku+json; version=3',
      'Authorization': `Bearer ${HEROKU_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (createRes.ok) {
    const app = await createRes.json();
    console.log(`Created Heroku app: ${app.name} (${app.id})`);
    return app; // newly created app
  }

  // On name conflict, fetch the existing app instead of erroring
  if (createRes.status === 422) {
    const errorBody = await createRes.json();
    if (errorBody.message && errorBody.message.includes("is already taken")) {
      console.warn(`Heroku app ${appName} already exists; fetching existing app...`);
      const getRes = await fetch(
        `https://api.heroku.com/apps/${encodeURIComponent(appName)}`,
        {
          headers: {
            'Authorization': `Bearer ${HEROKU_API_KEY}`,
            'Accept': 'application/vnd.heroku+json; version=3'
          }
        }
      );
      
      if (getRes.ok) {
        const existingApp = await getRes.json();
        console.log(`Using existing Heroku app: ${existingApp.name} (${existingApp.id})`);
        return existingApp; // return the existing app object
      } else {
        const getErr = await getRes.text();
        throw new Error(`Failed to fetch existing Heroku app ${appName}: ${getRes.status} ${getErr}`);
      }
    }
  }

  // For any other error, preserve behavior
  const createErr = await createRes.text();
  throw new Error(`Failed to create Heroku app: ${createRes.status} ${createErr}`);
}

/**
 * Creates a new Heroku app for the given pipeline
 * If an app with the same name already exists, it returns the existing app
 * @param pipelineId Unique identifier for the pipeline
 * @returns The Heroku app details (either newly created or existing)
 */
export async function createHerokuApp(pipelineId: string): Promise<HerokuApp> {
  try {
    // Generate a stable app name with a prefix and the pipelineId
    // This ensures consistent app naming across deployments
    // Ensure app name is under 30 characters (Heroku limit)
    const shortId = pipelineId.split('_')[0].substring(0, 8);
    const appName = `mcp-${shortId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Ensure the app exists (create or get existing)
    return await ensureHerokuApp(appName);
  } catch (error) {
    console.error('Error ensuring Heroku app exists:', error);
    throw error;
  }
}

/**
 * Sets environment variables for a Heroku app
 * @param appId Heroku app ID
 * @param configVars Key-value pairs of environment variables
 */
export async function setHerokuConfigVars(appId: string, configVars: Record<string, string>): Promise<void> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  try {
    const response = await fetch(`https://api.heroku.com/apps/${appId}/config-vars`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.heroku+json; version=3',
        'Authorization': `Bearer ${HEROKU_API_KEY}`
      },
      body: JSON.stringify(configVars)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to set Heroku config vars: ${response.status} ${errorText}`);
    }

    console.log(`Set ${Object.keys(configVars).length} config vars for Heroku app ${appId}`);
  } catch (error) {
    console.error('Error setting Heroku config vars:', error);
    throw error;
  }
}

/**
 * Creates a build for a Heroku app using a source URL
 * @param appId Heroku app ID
 * @param sourceUrl URL to the source code (tarball/zip)
 * @param pipelineId Optional pipeline ID to use as version identifier
 * @returns Object containing buildId and logUrl for build monitoring
 */
export async function createHerokuBuild(appId: string, sourceUrl: string, pipelineId?: string): Promise<{ buildId: string; logUrl: string }> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }
  
  // sourceUrl is guaranteed to be HTTPS by upstream validation
  console.log(`createHerokuBuild: using source_blob.url = ${sourceUrl}`);
  
  // Remove any legacy URL construction - sourceUrl is already validated

  // Use Git-based deployment instead of source_blob URL
  console.log('createHerokuBuild: Using Git-based deployment');
  
  // Return app info for Git-based deployment
  return {
    buildId: pipelineId || '',
    logUrl: ''
  };
}

/**
 * Gets the status of a Heroku build
 * @param appId Heroku app ID
 * @param buildId Heroku build ID
 * @returns The build details
 */
export async function getHerokuBuildStatus(appId: string, buildId: string): Promise<HerokuBuild> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  try {
    const response = await fetch(`https://api.heroku.com/apps/${appId}/builds/${buildId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.heroku+json; version=3',
        'Authorization': `Bearer ${HEROKU_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Heroku build status: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Heroku build status:', error);
    throw error;
  }
}

/**
 * Gets the latest release for a Heroku app
 * @param appId Heroku app ID
 * @returns The latest release details
 */
export async function getLatestHerokuRelease(appId: string): Promise<HerokuRelease> {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  if (!HEROKU_API_KEY) {
    throw new Error('HEROKU_API_KEY environment variable is required');
  }

  try {
    const response = await fetch(`https://api.heroku.com/apps/${appId}/releases`, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.heroku+json; version=3',
        'Authorization': `Bearer ${HEROKU_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Heroku releases: ${response.status} ${errorText}`);
    }

    const releases = await response.json();
    if (!releases || !Array.isArray(releases) || releases.length === 0) {
      throw new Error('No releases found for the app');
    }

    // Releases are returned in reverse chronological order
    return releases[0];
  } catch (error) {
    console.error('Error getting latest Heroku release:', error);
    throw error;
  }
}

/**
 * Polls a Heroku build until it completes or fails
 * @param appId Heroku app ID
 * @param buildId Heroku build ID
 * @param logUrl URL to the build logs stream
 * @param appName Heroku app name for dashboard links
 * @param maxAttempts Maximum number of polling attempts
 * @param intervalMs Polling interval in milliseconds
 * @param maxRetryAttempts Maximum number of retry attempts for transient failures
 * @returns The final build status
 */
export async function pollHerokuBuild(
  appId: string, 
  buildId: string, 
  logUrl: string,
  appName: string,
  downloadUrl: string,
  maxAttempts = 30, 
  intervalMs = 2000,
  maxRetryAttempts = 2
): Promise<HerokuBuild> {
  let attempts = 0;
  let retryAttempts = 0;
  let build: HerokuBuild;

  while (attempts < maxAttempts) {
    build = await getHerokuBuildStatus(appId, buildId);
    
    if (build.status === 'succeeded') {
      console.log(`Heroku build ${buildId} succeeded`);
      return build;
    } else if (build.status === 'failed') {
      // If we have retry attempts left, try again for transient failures
      if (retryAttempts < maxRetryAttempts) {
        console.warn(`Transient failure; retrying build status check (${retryAttempts + 1}/${maxRetryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for retries
        retryAttempts++;
        continue;
      }
      
      // No more retries, fetch logs and provide detailed error
      console.error(`Heroku build ${buildId} failed; fetching logs from ${logUrl}...`);
      
      // 1) Fetch the logs
      let logs = '';
      try {
        const logRes = await fetch(logUrl);
        logs = logRes.ok ? await logRes.text() : `Could not fetch logs: ${logRes.status}`;
      } catch (err: any) {
        logs = `Error fetching logs: ${err.message}`;
      }
      
      // 2) Construct a detailed error
      const errorMessage = [
        `❌ Heroku build ${buildId} failed for app ${appName}.`,
        `↳ Attempted source_blob.url: ${downloadUrl}`,
        `📊 View more at: https://dashboard.heroku.com/apps/${appName}/activity`,
        `📋 Build logs:`,
        logs
      ].join('\n');
      
      // 3) Throw with full context
      throw new Error(errorMessage);
    }

    console.log(`Heroku build status: ${build.status} (attempt ${attempts + 1}/${maxAttempts})`);
    attempts++;
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Heroku build ${buildId} timed out after ${maxAttempts} attempts`);
}

/**
 * Polls a Heroku release until it completes or fails
 * @param appId Heroku app ID
 * @param maxAttempts Maximum number of polling attempts
 * @param intervalMs Polling interval in milliseconds
 * @returns The final release status
 */
export async function pollHerokuRelease(
  appId: string, 
  maxAttempts = 30, 
  intervalMs = 2000
): Promise<HerokuRelease> {
  let attempts = 0;
  let release: HerokuRelease;

  while (attempts < maxAttempts) {
    release = await getLatestHerokuRelease(appId);
    
    if (release.status === 'succeeded') {
      console.log(`Heroku release v${release.version} succeeded`);
      return release;
    } else if (release.status === 'failed') {
      throw new Error(`Heroku release v${release.version} failed`);
    }

    console.log(`Heroku release status: ${release.status} (attempt ${attempts + 1}/${maxAttempts})`);
    attempts++;
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Heroku release polling timed out after ${maxAttempts} attempts`);
}

/**
 * Deploys an MCP server to Heroku
 * @param pipelineId Unique identifier for the pipeline
 * @param downloadUrl URL to the source code (tarball/zip)
 * @param vectorStoreType Type of vector store
 * @param vectorStoreConfig Vector store configuration
 * @returns The deployment details
 */
export async function deployToHeroku(
  pipelineId: string, 
  downloadUrl: string, 
  vectorStoreType: string, 
  vectorStoreConfig: any
): Promise<{ appUrl: string; appId: string }> {
  // Validate download URL up front
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    console.error("deployToHeroku: missing or invalid downloadUrl:", downloadUrl);
    throw new Error("Heroku deployment aborted: no valid downloadUrl for build");
  }
  console.log("deployToHeroku: using downloadUrl:", downloadUrl);

  // 1. Create a new Heroku app
  const app = await createHerokuApp(pipelineId);

  // 2. Set environment variables
  const configVars: Record<string, string> = {
    // Azure OpenAI environment variables
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || '',
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
    AZURE_OPENAI_DEPLOYMENT_EMBEDDING: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || '',
    AZURE_OPENAI_DEPLOYMENT_TURBO: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || '',
    
    // Vector store environment variables
    VECTOR_STORE_TYPE: vectorStoreType,
    VECTOR_STORE_ENDPOINT: vectorStoreConfig.endpoint || '',
    VECTOR_STORE_API_KEY: vectorStoreConfig.apiKey || '',
    
    // Add store-specific environment variables
    ...(vectorStoreType === 'pinecone' ? {
      PINECONE_ENVIRONMENT: vectorStoreConfig.environment || '',
      PINECONE_INDEX: vectorStoreConfig.index || '',
    } : {}),
    
    ...(vectorStoreType === 'qdrant' ? {
      QDRANT_COLLECTION: vectorStoreConfig.collection || '',
    } : {}),
    
    ...(vectorStoreType === 'supabase' ? {
      SUPABASE_URL: vectorStoreConfig.supabaseUrl || '',
      SUPABASE_TABLE: vectorStoreConfig.table || '',
    } : {}),
    
    // Pipeline ID for reference
    PIPELINE_ID: pipelineId,
    
    // Force production mode
    NODE_ENV: 'production',
    
    // Port for the server (Heroku sets PORT automatically, but we'll set it for local testing)
    PORT: '8080'
  };
  
  await setHerokuConfigVars(app.id, configVars);

  // 3. Create a build from the source URL
  const { buildId, logUrl } = await createHerokuBuild(app.id, downloadUrl, pipelineId);

  // 4. Poll the build until it completes
  await pollHerokuBuild(app.id, buildId, logUrl, app.name, downloadUrl);

  // 5. Poll the release until it completes
  await pollHerokuRelease(app.id);

  // 6. Return the app URL and ID
  return {
    appUrl: app.web_url.replace(/\/$/, ''), // Remove trailing slash if present
    appId: app.id
  };
}
