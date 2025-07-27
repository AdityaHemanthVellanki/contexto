import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeployment } from '@/hooks/useDeployment';
import { DeploymentStatus } from './DeploymentStatus';
import { Loader2, Rocket } from 'lucide-react';

interface DeployButtonProps {
  pipelineId: string;
  fileId?: string;
  envVars?: Record<string, string>;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
}

export function DeployButton({
  pipelineId,
  fileId,
  envVars = {},
  variant = 'default',
  size = 'default',
  className = '',
  children = 'Deploy to Heroku',
}: DeployButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { deploy, isDeploying, deploymentId, deploymentData } = useDeployment({
    onSuccess: () => setIsModalOpen(true),
  });

  const handleDeploy = async () => {
    try {
      await deploy(pipelineId, fileId, envVars);
    } catch (error) {
      console.error('Deployment failed:', error);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={handleDeploy}
        disabled={isDeploying}
      >
        {isDeploying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4" />
            {children}
          </>
        )}
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Deployment Status</DialogTitle>
            <DialogDescription>
              Track the progress of your MCP server deployment to Heroku.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {deploymentId ? (
              <DeploymentStatus 
                deploymentId={deploymentId} 
                onClose={() => setIsModalOpen(false)} 
              />
            ) : (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Starting deployment...
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
