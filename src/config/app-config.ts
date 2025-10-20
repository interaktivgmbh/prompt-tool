// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { config as loadEnv } from 'dotenv';
import { AVAILABLE_MODELS, getModelById, normalizeModelId, type ModelConfig } from './models';

const DEFAULT_SERVER_PORT = 3005;
const DEFAULT_SERVER_HOST = '0.0.0.0';
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/prompt_db';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_NEXTCLOUD_URL = 'http://localhost:8081';
const DEFAULT_NEXTCLOUD_USERNAME = 'admin';
const DEFAULT_NEXTCLOUD_PASSWORD = 'admin123';
const DEFAULT_NEXTCLOUD_BASE_PATH = '/prompts';
const DEFAULT_NODE_ENV = 'production';
const DEFAULT_LOG_LEVEL = 'info';

loadEnv();

export interface ServerConfig {
  port: number;
  host: string;
}

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  user: string;
  name: string;
}

export interface OpenAIConfig {
  apiKey: string;
  baseURL: string;
  defaultModelId: string;
  defaultModel: ModelConfig;
  embeddingModel: string;
}

export interface NextCloudConfig {
  url: string;
  username: string;
  password: string;
  basePath: string;
}

export interface AppConfig {
  runtime: {
    nodeEnv: string;
    logLevel: string;
    isDevelopment: boolean;
  };
  server: ServerConfig;
  database: DatabaseConfig;
  openai: OpenAIConfig;
  nextcloud: NextCloudConfig;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveDefaultModel(): ModelConfig {
  const defaultModelId =
    normalizeModelId(process.env.DEFAULT_MODEL) || AVAILABLE_MODELS[0]?.id || 'gpt-4o-mini';
  const model = getModelById(defaultModelId) ?? AVAILABLE_MODELS[0];

  if (!model) {
    throw new Error('No OpenAI models configured');
  }

  return model;
}

const defaultModel = resolveDefaultModel();
const nodeEnv = (process.env.NODE_ENV ?? DEFAULT_NODE_ENV).trim() || DEFAULT_NODE_ENV;
const logLevel = process.env.LOG_LEVEL?.trim() || DEFAULT_LOG_LEVEL;

const computedConfig: AppConfig = {
  runtime: {
    nodeEnv,
    logLevel,
    isDevelopment: nodeEnv === 'development',
  },
  server: {
    port: parsePort(process.env.PORT, DEFAULT_SERVER_PORT),
    host: (process.env.HOST ?? DEFAULT_SERVER_HOST).trim() || DEFAULT_SERVER_HOST,
  },
  database: {
    url: (process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL).trim() || DEFAULT_DATABASE_URL,
    host: process.env.DB_HOST?.trim() ?? '',
    port: parsePort(process.env.DB_PORT, 0),
    user: process.env.DB_USER?.trim() ?? '',
    name: process.env.DB_NAME?.trim() ?? '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
    baseURL: process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
    defaultModelId: defaultModel.id,
    defaultModel,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-large',
  },
  nextcloud: {
    url: process.env.NEXTCLOUD_URL?.trim() || DEFAULT_NEXTCLOUD_URL,
    username: process.env.NEXTCLOUD_USERNAME?.trim() || DEFAULT_NEXTCLOUD_USERNAME,
    password: process.env.NEXTCLOUD_PASSWORD?.trim() || DEFAULT_NEXTCLOUD_PASSWORD,
    basePath: process.env.NEXTCLOUD_BASE_PATH?.trim() || DEFAULT_NEXTCLOUD_BASE_PATH,
  },
};

export const appConfig: AppConfig = {
  ...computedConfig,
  runtime: { ...computedConfig.runtime },
  server: { ...computedConfig.server },
  database: { ...computedConfig.database },
  openai: { ...computedConfig.openai },
  nextcloud: { ...computedConfig.nextcloud },
};

export const DEFAULTS = {
  SERVER_PORT: DEFAULT_SERVER_PORT,
  SERVER_HOST: DEFAULT_SERVER_HOST,
  DATABASE_URL: DEFAULT_DATABASE_URL,
  OPENAI_BASE_URL: DEFAULT_OPENAI_BASE_URL,
  NEXTCLOUD_URL: DEFAULT_NEXTCLOUD_URL,
  NEXTCLOUD_USERNAME: DEFAULT_NEXTCLOUD_USERNAME,
  NEXTCLOUD_PASSWORD: DEFAULT_NEXTCLOUD_PASSWORD,
  NEXTCLOUD_BASE_PATH: DEFAULT_NEXTCLOUD_BASE_PATH,
  NODE_ENV: DEFAULT_NODE_ENV,
  LOG_LEVEL: DEFAULT_LOG_LEVEL,
} as const;
