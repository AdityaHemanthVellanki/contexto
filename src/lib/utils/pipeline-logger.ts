import chalk from 'chalk';

/**
 * Pipeline Logger - Production-grade logging utility for the AI pipeline
 * Provides standardized, color-coded, timestamped logs for all pipeline stages
 */
export class PipelineLogger {
  private pipelineId: string;
  private showTimestamps: boolean;
  private startTime: number;
  private lastStageTime: number;

  constructor(pipelineId: string, showTimestamps: boolean = true) {
    this.pipelineId = pipelineId;
    this.showTimestamps = showTimestamps;
    this.startTime = Date.now();
    this.lastStageTime = this.startTime;
  }

  /**
   * Log a pipeline stage header
   */
  stageHeader(stageName: string): void {
    const now = Date.now();
    const elapsedTotal = ((now - this.startTime) / 1000).toFixed(2);
    
    console.log('');
    console.log(chalk.magenta.bold(`🚀 [PIPELINE:${this.pipelineId}] ${stageName.toUpperCase()}`));
    if (this.showTimestamps) {
      console.log(chalk.gray(`├── ⏱️  Total elapsed: ${elapsedTotal}s`));
    }
  }

  /**
   * Log a pipeline stage completion
   */
  stageComplete(stageName: string, details?: Record<string, any>): void {
    const now = Date.now();
    const elapsed = ((now - this.lastStageTime) / 1000).toFixed(2);
    this.lastStageTime = now;
    
    console.log(chalk.green(`├── ✅ ${stageName} complete in ${elapsed}s`));
    
    if (details) {
      Object.entries(details).forEach(([key, value]) => {
        console.log(chalk.blue(`├── ├── ${key}: ${value}`));
      });
    }
  }

  /**
   * Log a pipeline stage progress
   */
  stageProgress(message: string, percent?: number): void {
    let progressMessage = `├── 🔄 ${message}`;
    if (percent !== undefined) {
      progressMessage += ` (${percent.toFixed(0)}%)`;
    }
    console.log(chalk.yellow(progressMessage));
  }

  /**
   * Log a pipeline stage error
   */
  stageError(stageName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`├── ❌ ${stageName} failed: ${errorMessage}`));
    
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(`├── Stack trace:`));
      console.error(chalk.gray(error.stack.split('\n').slice(1).join('\n')));
    }
    
    // Log API error details if available
    if (error instanceof Error && (error as any).response) {
      const apiError = (error as any).response;
      console.error(chalk.red(`├── API Error Details:`));
      console.error(chalk.red(`├── ├── Status: ${apiError.status}`));
      console.error(chalk.red(`├── ├── Status Text: ${apiError.statusText}`));
      
      if (apiError.data) {
        console.error(chalk.red(`├── ├── Response Data: ${JSON.stringify(apiError.data)}`));
      }
    }
  }

  /**
   * Log detailed information
   */
  info(message: string): void {
    console.log(chalk.blue(`├── ℹ️  ${message}`));
  }

  /**
   * Log a warning
   */
  warn(message: string): void {
    console.log(chalk.yellow(`├── ⚠️  ${message}`));
  }

  /**
   * Log API call details
   */
  apiCall(service: string, endpoint: string, params?: Record<string, any>): void {
    console.log(chalk.cyan(`├── 🌐 API Call: ${service} - ${endpoint}`));
    
    if (params) {
      const safeParams = { ...params };
      
      // Redact sensitive information
      if (safeParams.apiKey) safeParams.apiKey = '***';
      if (safeParams.api_key) safeParams.api_key = '***';
      if (safeParams.key) safeParams.key = '***';
      
      console.log(chalk.gray(`├── ├── Params: ${JSON.stringify(safeParams)}`));
    }
  }

  /**
   * Log API response details
   */
  apiResponse(service: string, status: number, data?: any): void {
    const statusColor = status >= 200 && status < 300 ? chalk.green : chalk.red;
    console.log(statusColor(`├── 📡 API Response: ${service} - Status ${status}`));
    
    if (data) {
      // Truncate large response data
      const stringData = typeof data === 'string' ? data : JSON.stringify(data);
      const truncatedData = stringData.length > 500 
        ? stringData.substring(0, 500) + '...' 
        : stringData;
      
      console.log(chalk.gray(`├── ├── Data: ${truncatedData}`));
    }
  }

  /**
   * Log token usage
   */
  tokenUsage(promptTokens: number, completionTokens: number, totalTokens: number): void {
    console.log(chalk.blue(`├── 🔢 Token Usage:`));
    console.log(chalk.gray(`├── ├── Prompt: ${promptTokens}`));
    console.log(chalk.gray(`├── ├── Completion: ${completionTokens}`));
    console.log(chalk.gray(`├── ├── Total: ${totalTokens}`));
  }

  /**
   * Log chunking details
   */
  chunkDetails(chunkCount: number, avgChunkSize: number): void {
    console.log(chalk.blue(`├── 📄 Chunking Details:`));
    console.log(chalk.gray(`├── ├── Chunks: ${chunkCount}`));
    console.log(chalk.gray(`├── ├── Avg Size: ${avgChunkSize.toFixed(0)} chars`));
  }

  /**
   * Log embedding details
   */
  embeddingDetails(count: number, dimensions: number, model: string): void {
    console.log(chalk.blue(`├── 🧠 Embedding Details:`));
    console.log(chalk.gray(`├── ├── Count: ${count}`));
    console.log(chalk.gray(`├── ├── Dimensions: ${dimensions}`));
    console.log(chalk.gray(`├── ├── Model: ${model}`));
  }

  /**
   * Log vector database details
   */
  vectorDBDetails(indexName: string, namespace: string, vectorCount: number): void {
    console.log(chalk.blue(`├── 🗃️  Vector DB Details:`));
    console.log(chalk.gray(`├── ├── Index: ${indexName}`));
    console.log(chalk.gray(`├── ├── Namespace: ${namespace || 'default'}`));
    console.log(chalk.gray(`├── ├── Vectors: ${vectorCount}`));
  }

  /**
   * Log retrieval details
   */
  retrievalDetails(query: string, matches: number, topScore: number): void {
    console.log(chalk.blue(`├── 🔍 Retrieval Details:`));
    console.log(chalk.gray(`├── ├── Query: "${query}"`));
    console.log(chalk.gray(`├── ├── Matches: ${matches}`));
    console.log(chalk.gray(`├── ├── Top Score: ${topScore.toFixed(4)}`));
  }
}

/**
 * Create a new pipeline logger
 */
export function createPipelineLogger(pipelineId: string, showTimestamps: boolean = true): PipelineLogger {
  return new PipelineLogger(pipelineId, showTimestamps);
}

export default PipelineLogger;
