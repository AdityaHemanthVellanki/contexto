# Heroku Deployment Configuration

This document explains how to configure the Heroku deployment for Contexto MCP servers.

## Environment Variables

The following environment variables must be set for Heroku deployments to work:

```bash
HEROKU_API_KEY=your-heroku-api-key
HEROKU_TEAM=your-team-name-or-personal-account  # Optional
HEROKU_REGION=us  # Optional, defaults to 'us'
```

## API Key

The `HEROKU_API_KEY` must be a valid Heroku Platform API token with permissions to create and manage apps. You can generate a new API key from your Heroku account settings page or using the Heroku CLI:

```bash
heroku authorizations:create -d "Contexto MCP Server Deployment"
```

## Team Configuration

If you want to deploy to a team account instead of your personal account, set the `HEROKU_TEAM` environment variable to your team name. If this is not set, deployments will go to your personal account.

## Region Configuration

The `HEROKU_REGION` environment variable specifies which region to deploy your apps to. Valid values include:

- `us` (United States)
- `eu` (Europe)

If not specified, it defaults to `us`.

## Deployment Process

1. The deployment process first creates a new Heroku app with a name based on the pipeline ID:
   ```
   https://api.heroku.com/apps
   ```

2. It then sets all necessary config variables for the app:
   ```
   https://api.heroku.com/apps/{app-name}/config-vars
   ```

3. Next, it creates a build using the source code from the exported MCP ZIP:
   ```
   https://api.heroku.com/apps/{app-name}/builds
   ```

4. Finally, it polls the release status until the app is successfully deployed:
   ```
   https://api.heroku.com/apps/{app-name}/releases
   ```

5. The deployment includes all necessary environment variables for the MCP server to function, including Azure OpenAI credentials and vector store configurations.

## Troubleshooting

If you encounter errors during deployment, check that:

1. Your `HEROKU_API_KEY` is valid and has the necessary permissions
2. You have not reached your app limit on Heroku
3. The app name is not already taken (Heroku app names must be globally unique)
4. You have properly configured any team settings if deploying to a team

## Deployment Logs

The deployment process logs the following information for debugging:

- App creation requests and responses
- Config variable setting status
- Build creation and status
- Release polling and status
- Health check results

Check these logs to verify that the correct API calls are being made and the deployment is progressing as expected.

## App Cleanup

To avoid accumulating unused Heroku apps, consider implementing a cleanup job that deletes old apps that are no longer needed. This can be done using the Heroku API:

```
DELETE https://api.heroku.com/apps/{app-name}
```

## VS Code Extension

The deployment process also generates and uploads a VS Code extension that can be used to interact with the deployed MCP server. The extension is configured with the deployed MCP server URL and can be installed directly in VS Code.
