// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${(config as { dimensions?: number })?.dimensions ?? 3072})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(`[${value.replace(/[{}]/g, '')}]`);
  },
});

// Prompts table (similar to instructions in the original)
export const prompts = pgTable(
  'prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: varchar('domain_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    prompt: text('prompt'),
    metadata: jsonb('metadata'),
    modelId: varchar('model_id', { length: 100 }),
    modelProvider: varchar('model_provider', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => ({
    domainIdIdx: index('prompts_domain_id_idx').on(table.domainId),
  })
);

// Prompt files table
export const promptFiles = pgTable(
  'prompt_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    promptId: uuid('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    domainId: varchar('domain_id', { length: 255 }).notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    nextcloudPath: varchar('nextcloud_path', { length: 500 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    promptIdIdx: index('prompt_files_prompt_id_idx').on(table.promptId),
    domainIdIdx: index('prompt_files_domain_id_idx').on(table.domainId),
  })
);

// Embeddings table with pgvector support
export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: varchar('domain_id', { length: 255 }).notNull(),
    promptId: uuid('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    chunkId: varchar('chunk_id', { length: 100 }).notNull(),
    text: text('text').notNull(),
    // Vector column with 3072 dimensions (OpenAI text-embedding-3-large)
    vector: vector('vector', { dimensions: 3072 }).notNull(),
  },
  (table) => ({
    domainIdIdx: index('embeddings_domain_id_idx').on(table.domainId),
    promptIdIdx: index('embeddings_prompt_id_idx').on(table.promptId),
  })
);

// Relations
export const promptsRelations = relations(prompts, ({ many }) => ({
  files: many(promptFiles),
  embeddings: many(embeddings),
}));

export const promptFilesRelations = relations(promptFiles, ({ one }) => ({
  prompt: one(prompts, {
    fields: [promptFiles.promptId],
    references: [prompts.id],
  }),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  prompt: one(prompts, {
    fields: [embeddings.promptId],
    references: [prompts.id],
  }),
}));

// TypeScript types inferred from schema
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

export type PromptFile = typeof promptFiles.$inferSelect;
export type NewPromptFile = typeof promptFiles.$inferInsert;

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;
