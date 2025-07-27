import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface UseDeploymentOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useDeployment({ onSuccess, onError }: UseDeploymentOptions = {}) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deploymentData, setDeploymentData] = useState<any>(null);
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
        throw new Error(
          errorData.error || `Deployment failed with status ${response.status}`
        );
      }

      const data = await response.json();
      setDeploymentId(data.deploymentId || null);
      setDeploymentData(data);
      
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
