import { z } from 'zod';

// Prompt schemas
export const createPromptSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  prompt: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  modelId: z.string().optional(),
  modelProvider: z.string().optional(),
});

export const updatePromptSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  prompt: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  modelId: z.string().optional(),
  modelProvider: z.string().optional(),
});

export const promptIdSchema = z.object({
  id: z.string().uuid(),
});

// Search schemas
export const similaritySearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional().default(5),
  minSimilarity: z.number().min(0).max(1).optional().default(0),
  promptId: z.string().uuid().optional(),
});

export const relatedPromptsSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional().default(5),
  minSimilarity: z.number().min(0).max(1).optional().default(0.3),
});

export const getContextSchema = z.object({
  promptId: z.string().uuid(),
  query: z.string().min(1),
  maxChunks: z.number().int().min(1).max(10).optional().default(3),
});

// Query params schemas
export const listPromptsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
  offset: z.string().transform(Number).pipe(z.number().int().min(0)).optional().default('0'),
});

// Response types
export type CreatePromptRequest = z.infer<typeof createPromptSchema>;
export type UpdatePromptRequest = z.infer<typeof updatePromptSchema>;
export type SimilaritySearchRequest = z.infer<typeof similaritySearchSchema>;
export type RelatedPromptsRequest = z.infer<typeof relatedPromptsSchema>;
export type GetContextRequest = z.infer<typeof getContextSchema>;
export type ListPromptsQuery = z.infer<typeof listPromptsQuerySchema>;
