/**
 * Content extractor for different file types
 * Extracts text content from various file formats
 */

export class ContentExtractor {
  /**
   * Extract text content based on MIME type
   */
  async extractText(content: Buffer | string, mimeType: string): Promise<string> {
    const contentStr = typeof content === 'string' ? content : content.toString('utf-8');

    switch (mimeType) {
      case 'text/plain':
        return this.extractPlainText(contentStr);

      case 'text/markdown':
      case 'text/x-markdown':
        return this.extractMarkdown(contentStr);

      case 'text/html':
        return this.extractHTML(contentStr);

      case 'application/json':
        return this.extractJSON(contentStr);

      default:
        // Try to extract as plain text for unknown types
        if (mimeType.startsWith('text/')) {
          return this.extractPlainText(contentStr);
        }
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }

  /**
   * Extract plain text (no processing needed)
   */
  private extractPlainText(content: string): string {
    return content.trim();
  }

  /**
   * Extract text from Markdown (remove formatting)
   */
  private extractMarkdown(content: string): string {
    let text = content;

    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');

    // Remove links but keep text: [text](url) -> text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove images: ![alt](url) -> alt
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

    // Remove headers: ### Header -> Header
    text = text.replace(/^#+\s+/gm, '');

    // Remove bold/italic: **text** or *text* -> text
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');

    // Remove horizontal rules
    text = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '');

    return text.trim();
  }

  /**
   * Extract text from HTML (remove tags)
   */
  private extractHTML(content: string): string {
    let text = content;

    // Remove script and style tags with content
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = this.decodeHTMLEntities(text);

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ');

    return text.trim();
  }

  /**
   * Extract text from JSON (format as readable text)
   */
  private extractJSON(content: string): string {
    try {
      const obj = JSON.parse(content);
      return this.stringifyJSON(obj);
    } catch {
      // If parsing fails, return as-is
      return content;
    }
  }

  /**
   * Recursively stringify JSON object to readable text
   */
  private stringifyJSON(obj: unknown, depth = 0): string {
    if (obj === null || obj === undefined) {
      return '';
    }

    if (typeof obj === 'string') {
      return obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.stringifyJSON(item, depth + 1)).join(' ');
    }

    if (typeof obj === 'object') {
      return Object.entries(obj)
        .map(([key, value]) => {
          const valueStr = this.stringifyJSON(value, depth + 1);
          return valueStr ? `${key}: ${valueStr}` : '';
        })
        .filter(Boolean)
        .join(' ');
    }

    return String(obj);
  }

  /**
   * Decode common HTML entities
   */
  private decodeHTMLEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
    };

    return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
  }

  /**
   * Detect MIME type from filename extension (basic implementation)
   */
  static detectMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      markdown: 'text/markdown',
      html: 'text/html',
      htm: 'text/html',
      json: 'application/json',
      js: 'text/plain',
      ts: 'text/plain',
      css: 'text/plain',
      xml: 'text/xml',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
