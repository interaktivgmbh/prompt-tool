import { db } from '@/core/database';
import { embeddings, prompts, type NewEmbedding } from '@/core/schema';
import { eq } from 'drizzle-orm';
import { MockEmbeddingsService } from './mock-embeddings';
import { TextChunker } from './text-chunker';

export interface ProcessedChunk {
  text: string;
  chunkId: string;
  source: string;
}

export interface EmbeddingServiceConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingDimensions?: number;
  useMock?: boolean;
}

export class EmbeddingService {
  private readonly textChunker: TextChunker;
  private readonly embeddingsModel: MockEmbeddingsService;
  private readonly useMock: boolean;

  constructor(config: EmbeddingServiceConfig = {}) {
    const {
      chunkSize = 1000,
      chunkOverlap = 200,
      embeddingDimensions = 3072,
      useMock = true,
    } = config;

    this.textChunker = new TextChunker({ chunkSize, chunkOverlap });
    this.embeddingsModel = new MockEmbeddingsService({
      dimensions: embeddingDimensions,
    });
    this.useMock = useMock;
  }

  /**
   * Chunk text into smaller pieces
   */
  chunkText(text: string): string[] {
    return this.textChunker.splitText(text);
  }

  /**
   * Generate embeddings for text chunks
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.useMock) {
      return this.embeddingsModel.embedBatch(texts);
    }
    // TODO: Implement real OpenAI embeddings
    throw new Error('Real OpenAI embeddings not implemented yet');
  }

  /**
   * Process prompt content and generate chunks
   */
  async processPromptContent(
    domainId: string,
    promptId: string,
    promptText: string | null
  ): Promise<ProcessedChunk[]> {
    const chunks: ProcessedChunk[] = [];

    // Process prompt text if available
    if (promptText) {
      const textChunks = this.chunkText(promptText);
      textChunks.forEach((chunk, index) => {
        chunks.push({
          text: chunk,
          chunkId: `prompt_${index}`,
          source: 'prompt',
        });
      });
    }

    return chunks;
  }

  /**
   * Process file content (placeholder for now)
   */
  async processFileContent(
    fileId: string,
    content: string,
    filename: string
  ): Promise<ProcessedChunk[]> {
    const chunks: ProcessedChunk[] = [];
    const textChunks = this.chunkText(content);

    textChunks.forEach((chunk, index) => {
      chunks.push({
        text: chunk,
        chunkId: `file_${fileId}_${index}`,
        source: `file:${filename}`,
      });
    });

    return chunks;
  }

  /**
   * Save embeddings to database
   */
  async saveEmbeddings(
    domainId: string,
    promptId: string,
    chunks: ProcessedChunk[]
  ): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    // Generate embeddings for all chunks
    const texts = chunks.map((c) => c.text);
    const vectors = await this.generateEmbeddings(texts);

    // Prepare embedding records
    const embeddingRecords: NewEmbedding[] = chunks.map((chunk, index) => ({
      domainId,
      promptId,
      chunkId: chunk.chunkId,
      text: chunk.text,
      vector: vectors[index] || [],
    }));

    // Insert into database
    await db.insert(embeddings).values(embeddingRecords);
  }

  /**
   * Delete all embeddings for a prompt
   */
  async deleteEmbeddingsForPrompt(
    domainId: string,
    promptId: string
  ): Promise<void> {
    await db
      .delete(embeddings)
      .where(eq(embeddings.promptId, promptId));
  }

  /**
   * Reindex a prompt's content
   */
  async reindexPrompt(domainId: string, promptId: string): Promise<number> {
    // Delete existing embeddings
    await this.deleteEmbeddingsForPrompt(domainId, promptId);

    // Get prompt data
    const [prompt] = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, promptId))
      .limit(1);

    if (!prompt) {
      throw new Error(`Prompt ${promptId} not found`);
    }

    // Process content
    const chunks = await this.processPromptContent(
      domainId,
      promptId,
      prompt.prompt
    );

    // Save new embeddings
    await this.saveEmbeddings(domainId, promptId, chunks);

    return chunks.length;
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(domainId: string): Promise<{
    totalEmbeddings: number;
    uniquePrompts: number;
  }> {
    const results = await db
      .select()
      .from(embeddings)
      .where(eq(embeddings.domainId, domainId));

    const uniquePrompts = new Set(results.map((r) => r.promptId)).size;

    return {
      totalEmbeddings: results.length,
      uniquePrompts,
    };
  }
}
