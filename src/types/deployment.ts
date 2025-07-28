/**
 * Type definitions for deployment-related functionality
 */

/**
 * Represents a file to be deployed to Heroku
 */
export interface HerokuFile {
  file: string;
  data: string;
}

/**
 * Vector store configuration interface
 */
export interface VectorStoreConfig {
  type: string;
  config: Record<string, unknown>;
}

/**
 * Environment variables for deployments
 */
export interface DeploymentEnvVars {
  [key: string]: string;
}

/**
 * Deployment status data
 */
export interface DeploymentData {
  id: string;
  deploymentId?: string;
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
  logs?: string[];
  url?: string;
  webUrl?: string;
  appName?: string;
  buildId?: string;
  error?: string;
}
