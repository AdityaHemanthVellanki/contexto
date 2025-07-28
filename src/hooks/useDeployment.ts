import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { DeploymentData } from '@/types/deployment';

interface UseDeploymentOptions {
  onSuccess?: (data: DeploymentData) => void;
  onError?: (error: Error) => void;
}

export function useDeployment({ onSuccess, onError }: UseDeploymentOptions = {}) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deploymentData, setDeploymentData] = useState<DeploymentData | null>(null);
  const { toast } = useToast();

  const deploy = async (pipelineId: string, fileId?: string, envVars: Record<string, string> = {}) => {
    setIsDeploying(true);
    setDeploymentId(null);
    setDeploymentData(null);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pipelineId,
          fileId,
          envVars,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = typeof errorData === 'object' && errorData !== null && 'error' in errorData
          ? String(errorData.error)
          : `Deployment failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      // Ensure response data matches DeploymentData
      const data: DeploymentData = await response.json();
      if (data) {
        setDeploymentId(data.deploymentId || null);
        setDeploymentData(data);
      } else {
        console.error('Invalid deployment data:', data);
      }
      
      if (onSuccess) {
        onSuccess(data);
      }

      toast({
        title: 'Deployment started',
        description: 'Your MCP server is being deployed to Heroku.',
      });

      return data;
    } catch (error: any) {
      console.error('Deployment error:', error);
      
      toast({
        title: 'Deployment failed',
        description: error.message || 'An error occurred during deployment',
        variant: 'destructive',
      });

      if (onError) {
        onError(error);
      }
      
      throw error;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    deploy,
    isDeploying,
    deploymentId,
    deploymentData,
  };
}
