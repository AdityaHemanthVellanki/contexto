import { getAuth, User } from 'firebase/auth';
import { Graph } from '@/services/executePipeline';

// Define interfaces for API responses
interface ApiResponse {
  error?: string;
  message?: string;
}

interface PipelineData {
  id: string;
  name: string;
  description: string;
  graph: Graph;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

interface PipelineExecutionResult {
  result: Array<{
    nodeId: string;
    output: any;
  }>;
  usageReport: {
    total: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCost: number;
    };
    byNode: Record<string, {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCost: number;
    }>;
  };
}

/**
 * Base API client for making authenticated requests to backend endpoints
 * Uses Firebase ID tokens for authentication
 */
class ApiClient {
  /**
   * Get an authentication token from Firebase
   * @returns Firebase ID token
   */
  private static async getAuthToken(): Promise<string> {
    const auth = getAuth();
    const user: User | null = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    return user.getIdToken();
  }

  private static async fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data as T;
  }

  /**
   * Get all pipelines for the current user
   */
  static async getPipelines(): Promise<PipelineData[]> {
    return this.fetchWithAuth<PipelineData[]>('/api/pipelines');
  }

  /**
   * Get a specific pipeline by ID
   */
  static async getPipeline(id: string): Promise<PipelineData> {
    return this.fetchWithAuth<PipelineData>(`/api/pipelines?id=${id}`);
  }

  /**
   * Create a new pipeline
   */
  static async createPipeline(pipeline: { name: string; description: string; graph: Graph }): Promise<PipelineData> {
    return this.fetchWithAuth<PipelineData>('/api/pipelines', {
      method: 'POST',
      body: JSON.stringify(pipeline)
    });
  }

  /**
   * Update an existing pipeline
   */
  static async updatePipeline(id: string, pipeline: { name: string; description: string; graph: Graph }): Promise<PipelineData> {
    return this.fetchWithAuth<PipelineData>('/api/pipelines', {
      method: 'PUT',
      body: JSON.stringify({
        id,
        ...pipeline
      })
    });
  }

  /**
   * Delete a pipeline by ID
   */
  static async deletePipeline(id: string): Promise<{ message: string }> {
    return this.fetchWithAuth<{ message: string }>(`/api/pipelines?id=${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Execute a pipeline with the given graph and prompt
   */
  static async runPipeline(pipelineId: string, graph: Graph, prompt: string): Promise<PipelineExecutionResult> {
    return this.fetchWithAuth<PipelineExecutionResult>('/api/runPipeline', {
      method: 'POST',
      body: JSON.stringify({
        pipelineId,
        graph,
        prompt
      })
    });
  }
}

export default ApiClient;
