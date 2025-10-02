// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { createChildLogger } from '@/core/logger';
import { LLMService } from './llm-service';
import { VectorSearchService } from './vector-search-service';
import type { ApplyPromptRequest } from '@/schemas/api-schemas';

const logger = createChildLogger('apply-service');

export interface ContextChunk {
  chunkId: string;
  text: string;
  similarityScore: number;
  source: string;
}

export interface ApplyResponse {
  promptId: string;
  promptName: string;
  query: string;
  response: string;
  contextUsed: ContextChunk[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  executionTimeMs: number;
  model: string;
}

export class ApplyService {
  private llmService: LLMService;
  private vectorService: VectorSearchService;

  constructor(options: { useMock?: boolean } = {}) {
    this.llmService = new LLMService();
    this.vectorService = new VectorSearchService(options);

    logger.info('Apply service initialized');
  }

  async applyPrompt(
    domainId: string,
    promptId: string,
    promptText: string,
    promptName: string,
    request: ApplyPromptRequest
  ): Promise<ApplyResponse> {
    const startTime = Date.now();

    logger.info({ promptId, domainId }, 'Applying prompt');

    // Retrieve context if requested
    const contextChunks: ContextChunk[] = [];
    let contextText = '';

    if (request.includeContext) {
      const searchResults = await this.vectorService.similaritySearch(domainId, request.query, {
        topK: request.maxContextChunks,
        minSimilarity: request.minSimilarity,
        promptId, // Limit search to this prompt only
      });

      for (const result of searchResults) {
        const source = result.chunkId.startsWith('file_') ? 'file' : 'prompt';
        contextChunks.push({
          chunkId: result.chunkId,
          text: result.text,
          similarityScore: result.similarityScore,
          source,
        });
      }

      // Build context text from chunks
      if (contextChunks.length > 0) {
        contextText = contextChunks.map((chunk, idx) => `[${idx + 1}] ${chunk.text}`).join('\n\n');
        logger.info({ chunks: contextChunks.length }, 'Retrieved context chunks');
      }
    }

    // Build the final prompt
    const systemPrompt = `You are a helpful assistant. The user has provided an instruction prompt that you should follow carefully.

Instruction: ${promptText}

${contextText ? `Additional Context:\n${contextText}\n\n` : ''}Follow the instruction above to process the user's query and text.`;

    const userPrompt = `Query: ${request.query}\n\nText to process:\n${request.text}`;

    // Generate LLM response
    const llmResponse = await this.llmService.generateResponse({
      systemPrompt,
      prompt: userPrompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      model: request.modelOverride,
    });

    const executionTimeMs = Date.now() - startTime;

    logger.info(
      {
        promptId,
        executionTimeMs,
        tokens: llmResponse.tokenUsage.totalTokens,
      },
      'Prompt applied successfully'
    );

    return {
      promptId,
      promptName,
      query: request.query,
      response: llmResponse.content,
      contextUsed: contextChunks,
      tokenUsage: llmResponse.tokenUsage,
      executionTimeMs,
      model: llmResponse.model,
    };
  }
}
