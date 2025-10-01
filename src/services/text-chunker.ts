/**
 * Text chunking utility for splitting large text into manageable chunks
 * Similar to LangChain's RecursiveCharacterTextSplitter
 */

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

export class TextChunker {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly separators: string[];

  constructor(options: ChunkOptions) {
    this.chunkSize = options.chunkSize;
    this.chunkOverlap = options.chunkOverlap;
    this.separators = options.separators || ['\n\n', '\n', '. ', ' ', ''];
  }

  /**
   * Split text into chunks recursively using different separators
   */
  splitText(text: string): string[] {
    return this.splitTextRecursive(text, this.separators);
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    // Base case: no more separators or text is small enough
    if (separators.length === 0 || text.length <= this.chunkSize) {
      return this.createChunksWithOverlap([text]);
    }

    const [separator, ...remainingSeparators] = separators;
    const splits = text.split(separator);

    // If separator didn't help, try next one
    if (splits.length === 1) {
      return this.splitTextRecursive(text, remainingSeparators);
    }

    // Merge small splits and recursively split large ones
    const chunks: string[] = [];
    let currentChunk = '';

    for (const split of splits) {
      const testChunk = currentChunk
        ? currentChunk + separator + split
        : split;

      if (testChunk.length <= this.chunkSize) {
        currentChunk = testChunk;
      } else {
        // Current chunk is full, save it
        if (currentChunk) {
          chunks.push(currentChunk);
        }

        // If split is still too large, recursively split it
        if (split.length > this.chunkSize) {
          const subChunks = this.splitTextRecursive(split, remainingSeparators);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = split;
        }
      }
    }

    // Add remaining chunk
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return this.createChunksWithOverlap(chunks);
  }

  /**
   * Add overlap between chunks for better context
   */
  private createChunksWithOverlap(chunks: string[]): string[] {
    if (this.chunkOverlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const overlappedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i] || '';

      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1] || '';
        const overlapText = prevChunk.slice(-this.chunkOverlap);
        chunk = overlapText + chunk;
      }

      overlappedChunks.push(chunk);
    }

    return overlappedChunks;
  }

  /**
   * Count total characters in text
   */
  static countCharacters(text: string): number {
    return text.length;
  }

  /**
   * Estimate number of chunks for given text
   */
  estimateChunks(text: string): number {
    return Math.ceil(text.length / (this.chunkSize - this.chunkOverlap));
  }
}
