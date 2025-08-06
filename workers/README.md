# Cloudflare Worker for R2 Proxy

This Cloudflare Worker acts as a secure proxy between Heroku and your private Cloudflare R2 bucket, allowing Heroku to download MCP pipeline packages without exposing your R2 credentials.

## Prerequisites

1. Cloudflare account with Workers enabled
2. Cloudflare R2 bucket with your MCP pipeline packages
3. Node.js and npm installed locally
4. Cloudflare Wrangler CLI installed: `npm install -g wrangler`

## Setup

1. **Authenticate Wrangler** (if not already done):
   ```bash
   wrangler login
   ```

2. **Create a new Cloudflare Worker**
   - Go to the [Cloudflare Workers dashboard](https://dash.cloudflare.com/)
   - Click "Create a Service"
   - Choose "HTTP handler"
   - Name it `contexto-r2-proxy`
   - Click "Create service"

3. **Set up environment variables**
   ```bash
   wrangler secret put CF_R2_ENDPOINT
   wrangler secret put CF_R2_BUCKET_NAME
   wrangler secret put CF_R2_ACCESS_KEY_ID
   wrangler secret put CF_R2_SECRET_ACCESS_KEY
   ```
   When prompted, enter the corresponding values for your R2 bucket.

## Local Development

1. Create a `.dev.vars` file in the `workers` directory with your local development variables:
   ```
   CF_R2_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
   CF_R2_BUCKET_NAME="your-bucket-name"
   CF_R2_ACCESS_KEY_ID="your-access-key-id"
   CF_R2_SECRET_ACCESS_KEY="your-secret-access-key"
   ```

2. Start the local development server:
   ```bash
   cd workers
   wrangler dev
   ```

## Deployment

To deploy to production:

```bash
cd workers
wrangler publish --env production
```

## Usage

After deployment, the worker will be available at:
```
https://contexto-r2-proxy.your-account.workers.dev/exports/{userId}/{fileId}/mcp-pipeline.zip
```

## Testing

Test the worker locally:

```bash
curl -I "http://localhost:8787/exports/test-user/test-file/mcp-pipeline.zip"
```

## Security Considerations

1. The worker is configured with CORS headers to only allow GET requests
2. URLs are validated to prevent path traversal attacks
3. Sensitive credentials are stored as secrets
4. The worker includes proper error handling and logging

## Monitoring

Monitor your worker in the [Cloudflare Workers dashboard](https://dash.cloudflare.com/) for:
- Request volume
- Error rates
- Execution time
- Resource usage
