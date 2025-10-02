// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import OpenAI from 'openai';
import { createChildLogger } from '@/core/logger';

const logger = createChildLogger('openai-embeddings');

export interface OpenAIEmbeddingsConfig {
  dimensions?: number;
  model?: string;
}

export class OpenAIEmbeddingsService {
  private client: OpenAI;
  private dimensions: number;
  private model: string;

  constructor(config: OpenAIEmbeddingsConfig = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.dimensions = config.dimensions || 3072;
    this.model = config.model || 'text-embedding-3-large';

    logger.info(
      {
        model: this.model,
        dimensions: this.dimensions,
      },
      'OpenAI embeddings service initialized'
    );
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI');
      }

      logger.debug(
        {
          textLength: text.length,
          embeddingLength: embedding.length,
        },
        'Generated embedding'
      );

      return embedding;
    } catch (error) {
      logger.error({ error, textLength: text.length }, 'Failed to generate embedding');
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI supports batch embedding generation
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      });

      const embeddings = response.data.map((item) => item.embedding);

      logger.info(
        {
          count: texts.length,
          totalTokens: response.usage?.total_tokens,
        },
        'Generated batch embeddings'
      );

      return embeddings;
    } catch (error) {
      logger.error({ error, count: texts.length }, 'Failed to generate batch embeddings');
      throw error;
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}
