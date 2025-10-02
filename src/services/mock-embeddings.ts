// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

/**
 * Mock embeddings service for development and testing
 * Generates deterministic fake embeddings without calling OpenAI API
 */

export interface EmbeddingOptions {
  dimensions: number;
  model?: string;
}

export class MockEmbeddingsService {
  private readonly dimensions: number;
  private readonly model: string;

  constructor(options: EmbeddingOptions) {
    this.dimensions = options.dimensions;
    this.model = options.model || 'mock-embedding-model';
  }

  /**
   * Generate a single embedding for text
   * Creates a deterministic vector based on text content
   */
  async embedText(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text);
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedText(text)));
  }

  /**
   * Generate a deterministic vector based on text content
   * Uses simple hash-based approach to create consistent embeddings
   */
  private generateDeterministicVector(text: string): number[] {
    const vector: number[] = [];

    // Simple hash function for deterministic generation
    const hash = this.simpleHash(text);

    // Use the hash as seed for pseudo-random number generation
    let seed = hash;

    for (let i = 0; i < this.dimensions; i++) {
      // Linear congruential generator for deterministic pseudo-random numbers
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      // Normalize to [-1, 1] range (typical for embeddings)
      const value = (seed / 0x7fffffff) * 2 - 1;
      vector.push(value);
    }

    // Normalize vector to unit length (L2 normalization)
    return this.normalizeVector(vector);
  }

  /**
   * Simple hash function for strings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

    if (magnitude === 0) {
      return vector.map(() => 0);
    }

    return vector.map((val) => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two vectors
   * Useful for testing and validation
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);

    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get model information
   */
  getModelInfo(): { model: string; dimensions: number } {
    return {
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}
