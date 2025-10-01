import { db } from '@/core/database';
import { embeddings, prompts, promptFiles, type NewEmbedding } from '@/core/schema';
import { eq } from 'drizzle-orm';
import { MockEmbeddingsService } from './mock-embeddings';
import { TextChunker } from './text-chunker';
import { getNextCloudStorage } from './nextcloud-storage';
import { ContentExtractor } from './content-extractor';

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
  async deleteEmbeddingsForPrompt(domainId: string, promptId: string): Promise<void> {
    await db.delete(embeddings).where(eq(embeddings.promptId, promptId));
  }

  /**
   * Reindex a prompt's content including files
   */
  async reindexPrompt(domainId: string, promptId: string): Promise<number> {
    // Delete existing embeddings
    await this.deleteEmbeddingsForPrompt(domainId, promptId);

    // Get prompt data
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, promptId)).limit(1);

    if (!prompt) {
      throw new Error(`Prompt ${promptId} not found`);
    }

    // Process prompt text
    const chunks = await this.processPromptContent(domainId, promptId, prompt.prompt);

    // Get associated files
    const files = await db.select().from(promptFiles).where(eq(promptFiles.promptId, promptId));

    // Process each file
    const storage = getNextCloudStorage();
    const contentExtractor = new ContentExtractor();

    for (const file of files) {
      try {
        // Download file from NextCloud
        const content = await storage.downloadFile({ path: file.nextcloudPath });

        // Extract text content
        const text = await contentExtractor.extractText(content, file.mimeType);

        // Process file content into chunks
        const fileChunks = await this.processFileContent(file.id, text, file.filename);

        chunks.push(...fileChunks);
      } catch (error) {
        console.error(`Failed to process file ${file.filename}:`, error);
        // Continue with other files
      }
    }

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
    const results = await db.select().from(embeddings).where(eq(embeddings.domainId, domainId));

    const uniquePrompts = new Set(results.map((r) => r.promptId)).size;

    return {
      totalEmbeddings: results.length,
      uniquePrompts,
    };
  }
}
