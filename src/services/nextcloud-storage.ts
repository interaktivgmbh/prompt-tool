// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { createClient, type WebDAVClient, type FileStat } from 'webdav';
import { createChildLogger } from '@/core/logger';

const logger = createChildLogger('nextcloud-storage');

export interface UploadOptions {
  path: string;
  content: Buffer | string;
  overwrite?: boolean;
}

export interface DownloadOptions {
  path: string;
}

export class NextCloudStorage {
  private client: WebDAVClient;
  private basePath: string;

  constructor(url: string, username: string, password: string, basePath: string = '/prompts') {
    this.basePath = basePath;

    // Create WebDAV client
    this.client = createClient(`${url}/remote.php/dav/files/${username}`, {
      username,
      password,
    });

    logger.info({ url, basePath }, 'NextCloud storage initialized');
  }

  /**
   * Initialize base directory structure
   */
  async initialize(): Promise<void> {
    try {
      const exists = await this.client.exists(this.basePath);
      if (!exists) {
        await this.client.createDirectory(this.basePath, { recursive: true });
        logger.info({ path: this.basePath }, 'Created base directory');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize storage');
      throw new Error('Failed to initialize NextCloud storage');
    }
  }

  /**
   * Upload a file to NextCloud
   */
  async uploadFile(options: UploadOptions): Promise<string> {
    const fullPath = this.getFullPath(options.path);

    try {
      // Ensure parent directory exists
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      const dirExists = await this.client.exists(dirPath);
      if (!dirExists) {
        await this.client.createDirectory(dirPath, { recursive: true });
      }

      // Upload file
      await this.client.putFileContents(fullPath, options.content, {
        overwrite: options.overwrite ?? true,
      });

      logger.info({ path: fullPath }, 'File uploaded successfully');
      return fullPath;
    } catch (error) {
      logger.error({ err: error, path: fullPath }, 'Failed to upload file');
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Download a file from NextCloud
   */
  async downloadFile(options: DownloadOptions): Promise<Buffer> {
    const fullPath = this.getFullPath(options.path);

    try {
      const content = await this.client.getFileContents(fullPath);

      if (content instanceof ArrayBuffer) {
        return Buffer.from(content);
      } else if (Buffer.isBuffer(content)) {
        return content;
      } else if (typeof content === 'string') {
        return Buffer.from(content);
      } else {
        throw new Error('Unexpected content type');
      }
    } catch (error) {
      logger.error({ err: error, path: fullPath }, 'Failed to download file');
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Delete a file from NextCloud
   */
  async deleteFile(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);

    try {
      // Check if file exists first
      const exists = await this.fileExists(path);
      if (!exists) {
        logger.warn({ path: fullPath }, 'File does not exist, skipping deletion');
        return;
      }

      await this.client.deleteFile(fullPath);
      logger.info({ path: fullPath }, 'File deleted successfully');
    } catch (error) {
      logger.error({ err: error, path: fullPath }, 'Failed to delete file');
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    try {
      return await this.client.exists(fullPath);
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileInfo(path: string): Promise<FileStat | null> {
    const fullPath = this.getFullPath(path);

    try {
      const stat = await this.client.stat(fullPath);
      return stat as FileStat;
    } catch (error) {
      logger.error({ err: error, path: fullPath }, 'Failed to get file info');
      return null;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string = ''): Promise<FileStat[]> {
    const fullPath = this.getFullPath(path);

    try {
      const contents = await this.client.getDirectoryContents(fullPath);
      return contents as FileStat[];
    } catch (error) {
      logger.error({ err: error, path: fullPath }, 'Failed to list files');
      return [];
    }
  }

  /**
   * Delete a directory and all its contents
   */
  async deleteDirectory(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);

    try {
      await this.client.deleteFile(fullPath);
      logger.info({ path: fullPath }, 'Directory deleted successfully');
    } catch (error) {
      logger.error({ err: error, path: fullPath }, 'Failed to delete directory');
      throw new Error(`Failed to delete directory: ${error}`);
    }
  }

  /**
   * Generate a path for storing a file
   */
  generateFilePath(domainId: string, promptId: string, filename: string): string {
    // Sanitize filename
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${domainId}/${promptId}/${sanitized}`;
  }

  /**
   * Get full path with base path prefix
   */
  private getFullPath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    return `${this.basePath}/${path}`;
  }
}

// Singleton instance
let storageInstance: NextCloudStorage | null = null;

export function getNextCloudStorage(): NextCloudStorage {
  if (!storageInstance) {
    const url = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
    const username = process.env.NEXTCLOUD_USERNAME || 'admin';
    const password = process.env.NEXTCLOUD_PASSWORD || 'admin123';
    const basePath = process.env.NEXTCLOUD_BASE_PATH || '/prompts';

    storageInstance = new NextCloudStorage(url, username, password, basePath);
  }

  return storageInstance;
}
