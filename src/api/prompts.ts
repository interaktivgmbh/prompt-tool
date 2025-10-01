import { Router } from 'express';
import multer from 'multer';
import { db } from '@/core/database';
import { prompts, promptFiles, type NewPromptFile } from '@/core/schema';
import { eq, and, desc } from 'drizzle-orm';
import { asyncHandler, AppError } from '@/middleware/error-handler';
import { validateDomainId, type DomainRequest } from '@/middleware/domain-validator';
import {
  createPromptSchema,
  updatePromptSchema,
  promptIdSchema,
  listPromptsQuerySchema,
  applyPromptSchema,
} from '@/schemas/api-schemas';
import { EmbeddingService } from '@/services/embedding-service';
import { getNextCloudStorage } from '@/services/nextcloud-storage';
import { ContentExtractor } from '@/services/content-extractor';
import { ApplyService } from '@/services/apply-service';
import { AVAILABLE_MODELS } from '@/config/models';

export const promptsRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const embeddingService = new EmbeddingService({ useMock: false });
const storage = getNextCloudStorage();
const applyService = new ApplyService({ useMock: false });

// List available models (no domain validation required)
promptsRouter.get('/models', (_req, res) => {
  res.json({
    models: AVAILABLE_MODELS,
    defaultModel: process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
  });
});

// Apply domain validation to all other routes
promptsRouter.use(validateDomainId);

// List prompts
promptsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const query = listPromptsQuerySchema.parse(req.query);

    const results = await db
      .select()
      .from(prompts)
      .where(eq(prompts.domainId, domainId))
      .orderBy(desc(prompts.createdAt))
      .limit(parseInt(query.limit as unknown as string))
      .offset(parseInt(query.offset as unknown as string));

    res.json({
      prompts: results,
      limit: query.limit,
      offset: query.offset,
    });
  })
);

// Get single prompt
promptsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const { id } = promptIdSchema.parse(req.params);

    const [prompt] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.domainId, domainId)))
      .limit(1);

    if (!prompt) {
      throw new AppError(404, 'Prompt not found');
    }

    res.json(prompt);
  })
);

// Create prompt (supports multipart with files or JSON)
promptsRouter.post(
  '/',
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const files = req.files as Express.Multer.File[];

    // Parse data - handle both multipart and JSON
    let data;
    if (req.is('multipart/form-data')) {
      // Parse metadata JSON if provided
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : undefined;
      data = createPromptSchema.parse({
        name: req.body.name,
        description: req.body.description,
        prompt: req.body.prompt,
        metadata,
        modelId: req.body.modelId,
        modelProvider: req.body.modelProvider,
      });
    } else {
      data = createPromptSchema.parse(req.body);
    }

    // Create prompt
    const [newPrompt] = await db
      .insert(prompts)
      .values({
        ...data,
        domainId,
      })
      .returning();

    if (!newPrompt) {
      throw new AppError(500, 'Failed to create prompt');
    }

    // Upload files if provided
    const uploadedFiles = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const nextcloudPath = storage.generateFilePath(domainId, newPrompt.id, file.originalname);

        await storage.uploadFile({
          path: nextcloudPath,
          content: file.buffer,
        });

        const mimeType = file.mimetype || ContentExtractor.detectMimeType(file.originalname);

        const [fileRecord] = await db
          .insert(promptFiles)
          .values({
            promptId: newPrompt.id,
            domainId,
            filename: file.originalname,
            mimeType,
            sizeBytes: file.size,
            nextcloudPath,
          } satisfies NewPromptFile)
          .returning();

        uploadedFiles.push(fileRecord);
      }
    }

    // Reindex synchronously if there's content to index
    if (newPrompt?.prompt || uploadedFiles.length > 0) {
      await embeddingService.reindexPrompt(domainId, newPrompt.id);
    }

    res.status(201).json({
      ...newPrompt,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    });
  })
);

// Update prompt
promptsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const { id } = promptIdSchema.parse(req.params);
    const data = updatePromptSchema.parse(req.body);

    // Check if prompt exists
    const [existing] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.domainId, domainId)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'Prompt not found');
    }

    // Update prompt
    const [updated] = await db
      .update(prompts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(prompts.id, id))
      .returning();

    // Reindex synchronously if prompt text changed
    if (data.prompt) {
      await embeddingService.reindexPrompt(domainId, id);
    }

    res.json(updated);
  })
);

// Delete prompt
promptsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const { id } = promptIdSchema.parse(req.params);

    // Check if prompt exists
    const [existing] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.domainId, domainId)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'Prompt not found');
    }

    // Delete prompt (cascades to embeddings)
    await db.delete(prompts).where(eq(prompts.id, id));

    res.status(204).send();
  })
);

// Apply prompt with LLM
promptsRouter.post(
  '/:id/apply',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const { id } = promptIdSchema.parse(req.params);
    const data = applyPromptSchema.parse(req.body);

    // Get prompt
    const [prompt] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.domainId, domainId)))
      .limit(1);

    if (!prompt) {
      throw new AppError(404, 'Prompt not found');
    }

    if (!prompt.prompt) {
      throw new AppError(400, 'Prompt has no instruction text');
    }

    // Apply the prompt using LLM + RAG
    const result = await applyService.applyPrompt(domainId, id, prompt.prompt, prompt.name || 'Untitled', data);

    res.json(result);
  })
);

// Get embedding stats
promptsRouter.get(
  '/stats/embeddings',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const stats = await embeddingService.getEmbeddingStats(domainId);
    res.json(stats);
  })
);
