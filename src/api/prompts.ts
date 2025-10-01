import { Router } from 'express';
import { db } from '@/core/database';
import { prompts } from '@/core/schema';
import { eq, and, desc } from 'drizzle-orm';
import { asyncHandler, AppError } from '@/middleware/error-handler';
import { validateDomainId, type DomainRequest } from '@/middleware/domain-validator';
import {
  createPromptSchema,
  updatePromptSchema,
  promptIdSchema,
  listPromptsQuerySchema,
} from '@/schemas/api-schemas';
import { EmbeddingService } from '@/services/embedding-service';

export const promptsRouter = Router();

// Apply domain validation to all routes
promptsRouter.use(validateDomainId);

const embeddingService = new EmbeddingService({ useMock: true });

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

// Create prompt
promptsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const data = createPromptSchema.parse(req.body);

    // Create prompt
    const [newPrompt] = await db
      .insert(prompts)
      .values({
        ...data,
        domainId,
      })
      .returning();

    // Generate embeddings in background (fire and forget)
    if (newPrompt?.prompt) {
      embeddingService
        .reindexPrompt(domainId, newPrompt.id)
        .catch((err) => console.error('Failed to index prompt:', err));
    }

    res.status(201).json(newPrompt);
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

    // Reindex if prompt text changed
    if (data.prompt) {
      embeddingService
        .reindexPrompt(domainId, id)
        .catch((err) => console.error('Failed to reindex prompt:', err));
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

// Reindex prompt
promptsRouter.post(
  '/:id/reindex',
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

    const chunkCount = await embeddingService.reindexPrompt(domainId, id);

    res.json({
      promptId: id,
      chunksGenerated: chunkCount,
      message: 'Prompt reindexed successfully',
    });
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
