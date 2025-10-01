import { Router } from 'express';
import { asyncHandler } from '@/middleware/error-handler';
import { validateDomainId, type DomainRequest } from '@/middleware/domain-validator';
import {
  similaritySearchSchema,
  relatedPromptsSchema,
  getContextSchema,
} from '@/schemas/api-schemas';
import { VectorSearchService } from '@/services/vector-search-service';

export const searchRouter = Router();

// Apply domain validation to all routes
searchRouter.use(validateDomainId);

const searchService = new VectorSearchService({ useMock: false });

// Similarity search across all prompts or within specific prompt
searchRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const data = similaritySearchSchema.parse(req.body);

    const results = await searchService.similaritySearch(domainId, data.query, {
      topK: data.topK,
      minSimilarity: data.minSimilarity,
      promptId: data.promptId,
    });

    res.json({
      query: data.query,
      results,
      count: results.length,
    });
  })
);

// Find related prompts
searchRouter.post(
  '/related',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const data = relatedPromptsSchema.parse(req.body);

    const results = await searchService.findRelatedPrompts(domainId, data.query, {
      topK: data.topK,
      minSimilarity: data.minSimilarity,
    });

    res.json({
      query: data.query,
      relatedPrompts: results,
      count: results.length,
    });
  })
);

// Get context for RAG
searchRouter.post(
  '/context',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const data = getContextSchema.parse(req.body);

    const context = await searchService.getPromptContext(
      domainId,
      data.promptId,
      data.query,
      data.maxChunks
    );

    res.json({
      promptId: data.promptId,
      query: data.query,
      context,
      length: context.length,
    });
  })
);

// Get embedding statistics
searchRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const { domainId } = req as DomainRequest;
    const stats = await searchService.getEmbeddingStats(domainId);
    res.json(stats);
  })
);
