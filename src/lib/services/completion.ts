import { OpenAI } from 'openai';
import chalk from 'chalk';
import { PromptContext } from './retriever';

export interface CompletionResult {
  response: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  responseTime: number;
  finishReason: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export class CompletionService {
  private openai: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'gpt-4o') {
    if (!apiKey) {
      console.error(chalk.red('├── ❌ OpenAI API key is missing!'));
      throw new Error('OpenAI API key is required for completion service');
    }

    this.openai = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;

    console.log(chalk.cyan(`├── 🧠 Completion service initialized (model: ${defaultModel})`));
  }

  async generateCompletion(
    promptContext: PromptContext,
    query: string,
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    
    console.log(chalk.yellow(`├── 🤖 Generating completion with ${model}`));
    console.log(chalk.blue(`├── [Query] User: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`));
    
    try {
      const startTime = Date.now();

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: promptContext.systemPrompt
        },
        {
          role: 'user',
          content: `Context:\n${promptContext.contextChunks}\n\nQuestion: ${query}`
        }
      ];

      console.log(chalk.blue(`├── [Prompt] Sending prompt with ${promptContext.chunksUsed} chunks, estimated ${promptContext.tokenCount} tokens`));

      const response = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 500,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
      });

      const responseTime = Date.now() - startTime;
      const choice = response.choices[0];
      const usage = response.usage;

      if (!choice?.message?.content) {
        throw new Error('No response content generated');
      }

      console.log(chalk.green(`├── [Completion] Response generated in ${responseTime}ms`));
      console.log(chalk.blue(`├── [Tokens] Prompt: ${usage?.prompt_tokens || 'unknown'}, Completion: ${usage?.completion_tokens || 'unknown'}, Total: ${usage?.total_tokens || 'unknown'}`));
      console.log(chalk.blue(`├── [Finish Reason] ${choice.finish_reason || 'unknown'}`));
      
      const responsePreview = choice.message.content.substring(0, 150);
      console.log(chalk.green(`├── [Answer] "${responsePreview}${choice.message.content.length > 150 ? '...' : ''}"`));

      return {
        response: choice.message.content,
        model,
        tokensUsed: {
          prompt: usage?.prompt_tokens || 0,
          completion: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
        },
        responseTime,
        finishReason: choice.finish_reason || 'unknown',
      };

    } catch (error) {
      console.error(chalk.red(`├── ❌ Completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Completion generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateStreamingCompletion(
    promptContext: PromptContext,
    query: string,
    options: CompletionOptions = {},
    onChunk?: (chunk: string) => void
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    
    console.log(chalk.yellow(`├── 🌊 Generating streaming completion with ${model}`));
    
    try {
      const startTime = Date.now();

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: promptContext.systemPrompt
        },
        {
          role: 'user',
          content: `Context:\n${promptContext.contextChunks}\n\nQuestion: ${query}`
        }
      ];

      const stream = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 500,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stream: true,
      });

      let fullResponse = '';
      let chunkCount = 0;

      console.log(chalk.blue(`├── [Streaming] Starting response stream`));

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          chunkCount++;
          
          if (onChunk) {
            onChunk(content);
          }
          
          // Log every 10th chunk to avoid spam
          if (chunkCount % 10 === 0) {
            console.log(chalk.gray(`├── [Stream] Received ${chunkCount} chunks...`));
          }
        }
      }

      const responseTime = Date.now() - startTime;

      console.log(chalk.green(`├── [Streaming] Complete in ${responseTime}ms (${chunkCount} chunks)`));
      console.log(chalk.green(`├── [Response] Length: ${fullResponse.length} characters`));

      return {
        response: fullResponse,
        model,
        tokensUsed: {
          prompt: 0, // Not available in streaming mode
          completion: 0,
          total: 0,
        },
        responseTime,
        finishReason: 'stop',
      };

    } catch (error) {
      console.error(chalk.red(`├── ❌ Streaming completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Streaming completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    
    console.log(chalk.yellow(`├── 💬 Generating chat completion with ${model}`));
    console.log(chalk.blue(`├── [Messages] ${messages.length} messages in conversation`));
    
    try {
      const startTime = Date.now();

      const response = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
      });

      const responseTime = Date.now() - startTime;
      const choice = response.choices[0];
      const usage = response.usage;

      if (!choice?.message?.content) {
        throw new Error('No response content generated');
      }

      console.log(chalk.green(`├── [Chat] Response generated in ${responseTime}ms`));
      console.log(chalk.blue(`├── [Tokens] Total: ${usage?.total_tokens || 'unknown'}`));

      return {
        response: choice.message.content,
        model,
        tokensUsed: {
          prompt: usage?.prompt_tokens || 0,
          completion: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
        },
        responseTime,
        finishReason: choice.finish_reason || 'unknown',
      };

    } catch (error) {
      console.error(chalk.red(`├── ❌ Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getAvailableModels(): string[] {
    return ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
  }
}

export const createCompletionService = (apiKey: string, defaultModel?: string) => {
  return new CompletionService(apiKey, defaultModel);
};
