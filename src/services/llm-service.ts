// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import OpenAI from 'openai';
import { createChildLogger } from '@/core/logger';
import { appConfig } from '@/config/app-config';
import { getModelById, normalizeModelId } from '@/config/models';

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
    const { openai } = appConfig;
    const { apiKey, baseURL, defaultModel } = openai;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.defaultModel = defaultModel.id;

    logger.info({ model: this.defaultModel, baseURL }, 'LLM service initialized with OpenAI');
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

    const normalizedModel = normalizeModelId(model) || this.defaultModel;
    const modelConfig = getModelById(normalizedModel);
    const modelToUse = modelConfig?.id || normalizedModel;

    if (!modelConfig) {
      logger.warn(
        { requestedModel: model, normalizedModel },
        'Using provided model without catalog entry'
      );
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
        model: modelToUse,
        provider: modelConfig?.provider,
        messageCount: messages.length,
        maxTokens,
        temperature,
      },
      'Generating LLM response'
    );

    try {
      const completion = await this.client.chat.completions.create({
        model: modelToUse,
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
      logger.error(
        { error, requestedModel: model, normalizedModel, modelToUse },
        'Failed to generate LLM response'
      );
      throw error;
    }
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
