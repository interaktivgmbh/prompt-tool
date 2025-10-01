import OpenAI from 'openai';
import { createChildLogger } from '@/core/logger';
import { getDefaultModel, getModelById } from '@/config/models';

const logger = createChildLogger('llm-service');

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export class LLMService {
  private client: OpenAI;
  private defaultModel: string;

  constructor() {
    // Use OpenRouter API
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/kyra-prompt-tool',
        'X-Title': 'Kyra Prompt Tool',
      },
    });

    this.defaultModel = getDefaultModel().id;

    logger.info({ model: this.defaultModel }, 'LLM service initialized with OpenRouter');
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    const {
      prompt,
      systemPrompt,
      context,
      maxTokens = 1000,
      temperature = 0.7,
      model = this.defaultModel,
    } = request;

    // Validate model exists
    const modelConfig = getModelById(model);
    if (!modelConfig) {
      logger.warn({ model }, 'Unknown model, using default');
    }

    // Build the messages array
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system message if provided
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add context if provided
    let userMessage = prompt;
    if (context) {
      userMessage = `Context:\n${context}\n\n${prompt}`;
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    logger.info(
      {
        model,
        provider: modelConfig?.provider,
        messageCount: messages.length,
        maxTokens,
        temperature,
      },
      'Generating LLM response'
    );

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      });

      const content = completion.choices[0]?.message?.content || '';
      const usage = completion.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      logger.info(
        {
          tokens: usage.total_tokens,
          model: completion.model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
        },
        'LLM response generated'
      );

      return {
        content,
        tokenUsage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        model: completion.model,
      };
    } catch (error) {
      logger.error({ error, model }, 'Failed to generate LLM response');
      throw error;
    }
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
