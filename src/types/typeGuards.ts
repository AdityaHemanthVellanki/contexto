import { DeploymentData } from '@/types/deployment';
import { PipelineData } from '@/types/pipeline';

export function isDeploymentData(data: unknown): data is DeploymentData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'status' in data &&
    'createdAt' in data
  );
}

export function isPipelineData(data: unknown): data is PipelineData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'steps' in data
  );
}
