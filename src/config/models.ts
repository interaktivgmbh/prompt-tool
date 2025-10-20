// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  costPer1MInputTokens: number;
  costPer1MOutputTokens: number;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    costPer1MInputTokens: 0.15,
    costPer1MOutputTokens: 0.6,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    costPer1MInputTokens: 2.5,
    costPer1MOutputTokens: 10,
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    costPer1MInputTokens: 0.3,
    costPer1MOutputTokens: 1.2,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    costPer1MInputTokens: 5,
    costPer1MOutputTokens: 15,
  },
];

export function normalizeModelId(modelId: string | undefined): string {
  if (!modelId) {
    return '';
  }

  const trimmed = modelId.trim();
  if (trimmed.includes('/')) {
    const [, bareId] = trimmed.split('/', 2);
    return bareId ?? '';
  }

  return trimmed;
}

export function getModelById(modelId: string): ModelConfig | undefined {
  const normalized = normalizeModelId(modelId);
  return AVAILABLE_MODELS.find((m) => m.id === normalized);
}
