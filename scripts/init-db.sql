-- SPDX-License-Identifier: Apache-2.0
-- Copyright 2025 Interaktiv GmbH

-- Initialize pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';
