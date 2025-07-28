import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { DeploymentData } from '@/types/deployment';

interface DeploymentStatusProps {
  deploymentId: string;
  onClose?: () => void;
}

type DeploymentStatus = 'pending' | 'building' | 'success' | 'failed' | 'deploying';

export function DeploymentStatus({ deploymentId, onClose }: DeploymentStatusProps) {
  const [deployment, setDeployment] = useState<DeploymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeploymentStatus = async (): Promise<DeploymentData | null> => {
    try {
      const response = await fetch(`/api/deploy/${deploymentId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deployment status');
      }

      const data = await response.json();
      return data as DeploymentData;
    } catch (err) {
      console.error('Error fetching deployment status:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const data = await fetchDeploymentStatus();
        if (isMounted) {
          if (data) {
            setDeployment(data);
          } else {
            console.error('Invalid deployment data received');
          }
        }
      } catch (error) {
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'An error occurred');
        }
      }
    };

    fetchData();
    
    // Set up polling
    const intervalId = setInterval(fetchData, 5000);
    
    // Clean up when component unmounts
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      const highestTimeoutId = window.setTimeout(() => {}, 0);
      for (let i = 0; i < highestTimeoutId; i++) {
        window.clearTimeout(i);
      }
    };
  }, [deploymentId]);

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }

    if (!deployment) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }

    switch (deployment.status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusText = () => {
    if (isLoading) {
      return 'Loading deployment status...';
    }

    if (!deployment) {
      return 'Deployment not found';
    }

    switch (deployment.status) {
      case 'pending':
        return 'Waiting to start deployment...';
      case 'building':
        return 'Building your MCP server...';
      case 'deploying':
        return 'Deploying to Heroku...';
      case 'success':
        return 'Deployment successful!';
      case 'failed':
        return 'Deployment failed';
      default:
        return 'Unknown status';
    }
  };

  const getActionButton = () => {
    if (!deployment) {
      return null;
    }

    if (deployment.status === 'success' && deployment.webUrl) {
      return (
        <a
          href={deployment.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Open MCP Server <ExternalLink className="h-4 w-4" />
        </a>
      );
    }

    if (deployment.status === 'failed' && deployment.buildId && deployment.appName) {
      return (
        <a
          href={`https://dashboard.heroku.com/apps/${deployment.appName}/activity/builds/${deployment.buildId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View Build Logs <ExternalLink className="h-4 w-4" />
        </a>
      );
    }

    return null;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-lg font-medium">
              {deployment?.appName || 'MCP Server Deployment'}
            </CardTitle>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Close</span>
              <span aria-hidden="true">×</span>
            </Button>
          )}
        </div>
        <CardDescription>{getStatusText()}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {deployment?.error && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">
                {deployment.error}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {deployment?.updatedAt && (
                <span>
                  Last updated:{' '}
                  {new Date(deployment.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
            {getActionButton()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
