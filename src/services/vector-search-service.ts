// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { db } from '@/core/database';
import { embeddings, prompts } from '@/core/schema';
import { and, eq, sql } from 'drizzle-orm';
import { MockEmbeddingsService } from './mock-embeddings';
import { OpenAIEmbeddingsService } from './openai-embeddings';

export interface SearchResult {
  embeddingId: string;
  promptId: string;
  chunkId: string;
  text: string;
  promptName: string | null;
  promptDescription: string | null;
  similarityScore: number;
}

export interface RelatedPrompt {
  promptId: string;
  promptName: string | null;
  promptDescription: string | null;
  maxSimilarity: number;
  bestChunk: string;
  chunkCount: number;
}

export interface VectorSearchConfig {
  embeddingDimensions?: number;
  useMock?: boolean;
}

export class VectorSearchService {
  private readonly mockEmbeddingsModel: MockEmbeddingsService;
  private readonly openaiEmbeddingsModel: OpenAIEmbeddingsService | null;
  private readonly useMock: boolean;

  constructor(config: VectorSearchConfig = {}) {
    const { embeddingDimensions = 3072, useMock = false } = config;

    this.mockEmbeddingsModel = new MockEmbeddingsService({
      dimensions: embeddingDimensions,
    });
    this.useMock = useMock;

    // Initialize OpenAI embeddings if not using mock
    if (!useMock) {
      this.openaiEmbeddingsModel = new OpenAIEmbeddingsService({
        dimensions: embeddingDimensions,
      });
    } else {
      this.openaiEmbeddingsModel = null;
    }
  }

  /**
   * Perform similarity search for a query within a domain
   */
  async similaritySearch(
    domainId: string,
    query: string,
    options: {
      topK?: number;
      promptId?: string;
      minSimilarity?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, promptId, minSimilarity = 0.0 } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(query);
    const queryVector = this.formatVector(queryEmbedding);

    // Build the where conditions
    const whereConditions = promptId
      ? and(eq(embeddings.domainId, domainId), eq(embeddings.promptId, promptId))
      : eq(embeddings.domainId, domainId);

    // Build the query with pgvector cosine distance operator (<=>)
    const results = await db
      .select({
        embeddingId: embeddings.id,
        promptId: embeddings.promptId,
        chunkId: embeddings.chunkId,
        text: embeddings.text,
        promptName: prompts.name,
        promptDescription: prompts.description,
        // Calculate similarity score: 1 - cosine distance
        similarityScore: sql<number>`1 - (${embeddings.vector} <=> ${queryVector})`,
      })
      .from(embeddings)
      .innerJoin(prompts, eq(embeddings.promptId, prompts.id))
      .where(whereConditions)
      .orderBy(sql`${embeddings.vector} <=> ${queryVector}`)
      .limit(topK);

    // Filter by minimum similarity
    return results
      .filter((r) => r.similarityScore >= minSimilarity)
      .map((r) => ({
        embeddingId: r.embeddingId,
        promptId: r.promptId,
        chunkId: r.chunkId,
        text: r.text,
        promptName: r.promptName,
        promptDescription: r.promptDescription,
        similarityScore: r.similarityScore,
      }));
  }

  /**
   * Search for similar content within a specific prompt
   */
  async searchWithinPrompt(
    domainId: string,
    promptId: string,
    query: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    return this.similaritySearch(domainId, query, { topK, promptId });
  }

  /**
   * Find prompts related to a query by aggregating chunk similarities
   */
  async findRelatedPrompts(
    domainId: string,
    query: string,
    options: {
      topK?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<RelatedPrompt[]> {
    const { topK = 5, minSimilarity = 0.3 } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(query);
    const queryVector = this.formatVector(queryEmbedding);

    // Query to find best matching chunk per prompt
    const results = await db
      .select({
        promptId: embeddings.promptId,
        promptName: prompts.name,
        promptDescription: prompts.description,
        text: embeddings.text,
        similarityScore: sql<number>`1 - (${embeddings.vector} <=> ${queryVector})`,
      })
      .from(embeddings)
      .innerJoin(prompts, eq(embeddings.promptId, prompts.id))
      .where(eq(embeddings.domainId, domainId))
      .orderBy(sql`${embeddings.vector} <=> ${queryVector}`);

    // Group by prompt and find best chunks
    const promptMap = new Map<string, RelatedPrompt>();

    for (const result of results) {
      if (result.similarityScore < minSimilarity) continue;

      const existing = promptMap.get(result.promptId);

      if (!existing || result.similarityScore > existing.maxSimilarity) {
        const bestChunk =
          result.text.length > 200 ? result.text.substring(0, 200) + '...' : result.text;

        promptMap.set(result.promptId, {
          promptId: result.promptId,
          promptName: result.promptName,
          promptDescription: result.promptDescription,
          maxSimilarity: result.similarityScore,
          bestChunk,
          chunkCount: (existing?.chunkCount || 0) + 1,
        });
      } else {
        const current = promptMap.get(result.promptId);
        if (current) {
          current.chunkCount++;
        }
      }
    }

    // Sort by similarity and return top K
    return Array.from(promptMap.values())
      .sort((a, b) => b.maxSimilarity - a.maxSimilarity)
      .slice(0, topK);
  }

  /**
   * Get the most relevant context from a prompt for a given query
   */
  async getPromptContext(
    domainId: string,
    promptId: string,
    query: string,
    maxChunks: number = 3
  ): Promise<string> {
    const similarChunks = await this.searchWithinPrompt(domainId, promptId, query, maxChunks);

    if (similarChunks.length === 0) {
      return '';
    }

    // Concatenate the most relevant chunks with similarity scores
    const contextParts = similarChunks.map(
      (chunk) => `[Score: ${chunk.similarityScore.toFixed(3)}] ${chunk.text}`
    );

    return contextParts.join('\n\n');
  }

  /**
   * Get embedding statistics for a domain
   */
  async getEmbeddingStats(domainId: string): Promise<{
    totalEmbeddings: number;
    promptsWithEmbeddings: number;
    averageChunkLength: number;
  }> {
    const results = await db
      .select({
        id: embeddings.id,
        promptId: embeddings.promptId,
        textLength: sql<number>`length(${embeddings.text})`,
      })
      .from(embeddings)
      .where(eq(embeddings.domainId, domainId));

    const uniquePrompts = new Set(results.map((r) => r.promptId)).size;
    const totalLength = results.reduce((sum, r) => sum + r.textLength, 0);
    const averageLength = results.length > 0 ? totalLength / results.length : 0;

    return {
      totalEmbeddings: results.length,
      promptsWithEmbeddings: uniquePrompts,
      averageChunkLength: Math.round(averageLength),
    };
  }

  /**
   * Generate embedding for a query
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    if (this.useMock) {
      return this.mockEmbeddingsModel.embedText(query);
    }

    if (!this.openaiEmbeddingsModel) {
      throw new Error('OpenAI embeddings not initialized');
    }

    return this.openaiEmbeddingsModel.generateEmbedding(query);
  }

  /**
   * Format vector for SQL query (pgvector format)
   */
  private formatVector(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }

  /**
   * Calculate cosine similarity between two vectors (utility method)
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    return MockEmbeddingsService.cosineSimilarity(a, b);
  }
}
