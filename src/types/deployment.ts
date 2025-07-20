/**
 * Type definitions for deployment-related functionality
 */

/**
 * Represents a file to be deployed to Vercel
 */
export interface VercelFile {
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
