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
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    costPer1MInputTokens: 0.15,
    costPer1MOutputTokens: 0.6,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    costPer1MInputTokens: 2.5,
    costPer1MOutputTokens: 10,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    costPer1MInputTokens: 3,
    costPer1MOutputTokens: 15,
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    costPer1MInputTokens: 0.25,
    costPer1MOutputTokens: 1.25,
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    costPer1MInputTokens: 0.075,
    costPer1MOutputTokens: 0.3,
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    costPer1MInputTokens: 1.25,
    costPer1MOutputTokens: 5,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    contextWindow: 64000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    costPer1MInputTokens: 0.14,
    costPer1MOutputTokens: 0.28,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    provider: 'Meta',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    costPer1MInputTokens: 0.52,
    costPer1MOutputTokens: 0.75,
  },
];

export function getModelById(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}

export function getDefaultModel(): ModelConfig {
  const defaultModelId = process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini';
  const model = getModelById(defaultModelId);
  if (model) return model;

  // Fallback to first model (should always exist)
  const fallback = AVAILABLE_MODELS[0];
  if (!fallback) {
    throw new Error('No models configured');
  }
  return fallback;
}
