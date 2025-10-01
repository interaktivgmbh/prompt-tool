import { Router } from 'express';
import multer from 'multer';
import { db } from '@/core/database';
import { prompts, promptFiles, type NewPromptFile } from '@/core/schema';
import { eq, and } from 'drizzle-orm';
import { asyncHandler, AppError } from '@/middleware/error-handler';
import { validateDomainId, type DomainRequest } from '@/middleware/domain-validator';
import { getNextCloudStorage } from '@/services/nextcloud-storage';
import { EmbeddingService } from '@/services/embedding-service';
import { ContentExtractor } from '@/services/content-extractor';

export const filesRouter = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Apply domain validation to all routes
filesRouter.use(validateDomainId);

const storage = getNextCloudStorage();
const embeddingService = new EmbeddingService({ useMock: false });
const contentExtractor = new ContentExtractor();

// Upload files to a prompt
filesRouter.post(
  '/:promptId/files',
  upload.array('files', 10), // Max 10 files per request
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const promptId = req.params.promptId!;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError(400, 'No files provided');
    }

    // Check if prompt exists
    const [prompt] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, promptId), eq(prompts.domainId, domainId)))
      .limit(1);

    if (!prompt) {
      throw new AppError(404, 'Prompt not found');
    }

    // Upload files to NextCloud and save metadata
    const uploadedFiles = [];

    for (const file of files) {
      // Generate NextCloud path
      const nextcloudPath = storage.generateFilePath(domainId, promptId, file.originalname);

      // Upload to NextCloud
      await storage.uploadFile({
        path: nextcloudPath,
        content: file.buffer,
      });

      // Detect MIME type if not provided
      const mimeType = file.mimetype || ContentExtractor.detectMimeType(file.originalname);

      // Save file metadata to database
      const [fileRecord] = await db
        .insert(promptFiles)
        .values({
          promptId,
          domainId,
          filename: file.originalname,
          mimeType,
          sizeBytes: file.size,
          nextcloudPath,
        } satisfies NewPromptFile)
        .returning();

      uploadedFiles.push(fileRecord);
    }

    // Reindex synchronously after file upload
    await embeddingService.reindexPrompt(domainId, promptId);

    res.status(201).json({
      promptId,
      filesUploaded: uploadedFiles.length,
      files: uploadedFiles,
    });
  })
);

// List files for a prompt
filesRouter.get(
  '/:promptId/files',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const promptId = req.params.promptId!;

    // Check if prompt exists
    const [prompt] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, promptId), eq(prompts.domainId, domainId)))
      .limit(1);

    if (!prompt) {
      throw new AppError(404, 'Prompt not found');
    }

    // Get all files for the prompt
    const files = await db.select().from(promptFiles).where(eq(promptFiles.promptId, promptId));

    res.json({
      promptId,
      count: files.length,
      files,
    });
  })
);

// Download file content
filesRouter.get(
  '/:promptId/files/:fileId/download',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const promptId = req.params.promptId!;
    const fileId = req.params.fileId!;

    // Get file metadata
    const [file] = await db
      .select()
      .from(promptFiles)
      .where(
        and(
          eq(promptFiles.id, fileId),
          eq(promptFiles.promptId, promptId),
          eq(promptFiles.domainId, domainId)
        )
      )
      .limit(1);

    if (!file) {
      throw new AppError(404, 'File not found');
    }

    // Download from NextCloud
    const content = await storage.downloadFile({ path: file.nextcloudPath });

    // Set response headers
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.sizeBytes);

    res.send(content);
  })
);

// Get file content as text
filesRouter.get(
  '/:promptId/files/:fileId/content',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const promptId = req.params.promptId!;
    const fileId = req.params.fileId!;

    // Get file metadata
    const [file] = await db
      .select()
      .from(promptFiles)
      .where(
        and(
          eq(promptFiles.id, fileId),
          eq(promptFiles.promptId, promptId),
          eq(promptFiles.domainId, domainId)
        )
      )
      .limit(1);

    if (!file) {
      throw new AppError(404, 'File not found');
    }

    // Download from NextCloud
    const content = await storage.downloadFile({ path: file.nextcloudPath });

    // Extract text content
    const text = await contentExtractor.extractText(content, file.mimeType);

    res.json({
      fileId: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      text,
      length: text.length,
    });
  })
);

// Delete a file
filesRouter.delete(
  '/:promptId/files/:fileId',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const promptId = req.params.promptId!;
    const fileId = req.params.fileId!;

    // Get file metadata
    const [file] = await db
      .select()
      .from(promptFiles)
      .where(
        and(
          eq(promptFiles.id, fileId),
          eq(promptFiles.promptId, promptId),
          eq(promptFiles.domainId, domainId)
        )
      )
      .limit(1);

    if (!file) {
      throw new AppError(404, 'File not found');
    }

    // Delete from NextCloud
    await storage.deleteFile(file.nextcloudPath);

    // Delete from database (will cascade to embeddings)
    await db.delete(promptFiles).where(eq(promptFiles.id, fileId));

    // Reindex synchronously after file deletion
    await embeddingService.reindexPrompt(domainId, promptId);

    res.status(204).send();
  })
);
