# Railway Deployment Configuration

This document explains how to configure the Railway deployment for Contexto MCP servers.

## Environment Variables

The following environment variables must be set for Railway deployments to work:

```bash
RAILWAY_TOKEN=your-railway-api-token
RAILWAY_PROJECT_ID=e2325132-6419-4baa-abd9-0c9f2f032cf7
```

## Project Slug Format

The `RAILWAY_PROJECT_ID` must be the UUID from your Railway project URL. For example:

If your Railway project URL is:
```
https://railway.app/project/e2325132-6419-4baa-abd9-0c9f2f032cf7
```

Then your `RAILWAY_PROJECT_ID` should be:
```
e2325132-6419-4baa-abd9-0c9f2f032cf7
```

This is the exact path segment in the URL that identifies your project.

## Deployment Process

1. The deployment process first checks if the project exists by making a request to:
   ```
   https://api.railway.app/v1/projects/{RAILWAY_PROJECT_ID}
   ```

2. If the project exists, it then creates a deployment by making a request to:
   ```
   https://api.railway.app/v1/projects/{RAILWAY_PROJECT_ID}/deployments
   ```

3. The deployment includes all necessary environment variables for the MCP server to function, including Azure OpenAI credentials and vector store configurations.

## Troubleshooting

If you encounter a 404 "Not Found" error during deployment, check that:

1. Your `RAILWAY_TOKEN` is valid and has the necessary permissions
2. Your `RAILWAY_PROJECT_ID` exactly matches the UUID from your Railway project URL
3. You have properly URL-encoded the slug in API requests

## Deployment Logs

The deployment process logs the following information for debugging:

- Project URL being checked
- Project slug being used
- Deployment URL being used
- Response status codes
- Response bodies (with sensitive information redacted)

Check these logs to verify that the correct URLs are being constructed and used.
