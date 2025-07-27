/**
 * Export service for generating pipeline download URLs
 * Enforces CF_R2_ENDPOINT and guarantees valid HTTPS URLs
 */

/**
 * Get the Cloudflare R2 endpoint from environment
 * Throws error if not configured or invalid
 */
function getR2Endpoint(): string {
  const CF_R2_ENDPOINT = process.env.CF_R2_ENDPOINT;
  
  if (!CF_R2_ENDPOINT || !CF_R2_ENDPOINT.startsWith('https://')) {
    throw new Error(
      'exportService: Missing or invalid CF_R2_ENDPOINT env var; must be a full https:// URL'
    );
  }
  
  return CF_R2_ENDPOINT.replace(/\/+$/g, ''); // Remove trailing slashes
}

/**
 * Generate a pipeline export download URL
 * Always uses the configured CF_R2_ENDPOINT
 */
export function getPipelineExportUrl(userId: string, fileId: string): string {
  try {
    const baseUrl = getR2Endpoint();
    
    // Construct the R2 key exactly as the export writes it
    const r2Key = `users/${encodeURIComponent(userId)}/exports/${encodeURIComponent(fileId)}/mcp-pipeline.zip`;
    
    // Compose the final URL - always HTTPS
    const downloadUrl = `${baseUrl}/${r2Key}`;
    
    console.log('exportService: composed downloadUrl =', downloadUrl);
    
    return downloadUrl;
  } catch (error) {
    console.error('exportService: Error generating pipeline export URL:', error);
    throw error;
  }
}

/**
 * Validate a download URL for Heroku deployment
 * Ensures the URL is a string and starts with https://
 */
export function validateDownloadUrl(url: string): string {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    console.error('validateDownloadUrl: got invalid URL:', url);
    throw new Error(`Invalid download URL (must start with https://): ${url}`);
  }
  return url;
}
