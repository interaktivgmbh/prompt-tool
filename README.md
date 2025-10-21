# Prompt Tool

Prompt management service with file attachments, vector search, and LLM integration.

Built with TypeScript, Bun, Express, PostgreSQL (pgvector), NextCloud storage, and OpenAI.

## Features

- **Prompt Management** - CRUD operations with metadata
- **File Storage** - Upload/download files via NextCloud WebDAV
- **Vector Search** - Semantic similarity search with pgvector
- **Embeddings** - Automatic indexing with OpenAI text-embedding-3-large (3072 dimensions)
- **LLM Integration** - Execute prompts via OpenAI (GPT-4o family)
- **Multi-tenancy** - Domain isolation via `x-domain-id` header
- **RAG Support** - Context-enhanced prompt execution

## Quick Start

### Prerequisites

- **Bun** (v1.2.0+): `curl -fsSL https://bun.sh/install | bash`
- **Docker & Docker Compose**
- **jq**: `brew install jq` (macOS) or `sudo apt-get install jq` (Linux)
- **API Keys**: [OpenAI](https://platform.openai.com/api-keys)

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your API configuration:
#   OPENAI_API_KEY=sk-...
#   OPENAI_BASE_URL=https://api.openai.com/v1
#   OPENAI_EMBEDDING_MODEL=text-embedding-3-large

# 3. Start infrastructure (PostgreSQL + NextCloud)
bun run docker:up

# 4. Initialize database
bun run db:push --force

# 5. Start application
bun run dev

# 6. Verify (in another terminal)
curl http://localhost:3005/health | jq

# 7. Run tests
./test-all.sh
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3005` | HTTP server port |
| `DATABASE_URL` | No | `postgresql://...` | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key (embeddings + chat) |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Override OpenAI API base URL (for Azure/proxy setups) |
| `OPENAI_EMBEDDING_MODEL` | No | `text-embedding-3-large` | Embedding model id used for vector indexing |
| `NEXTCLOUD_URL` | No | `http://localhost:8081` | NextCloud WebDAV URL |
| `NEXTCLOUD_USERNAME` | No | `admin` | NextCloud username |
| `NEXTCLOUD_PASSWORD` | No | `admin` | NextCloud password |

## API Endpoints

All endpoints require `x-domain-id` header for multi-tenancy.

### Prompts

- `POST /api/prompts` - Create prompt
- `GET /api/prompts` - List prompts (pagination: `?page=1&size=10`)
- `GET /api/prompts/:id` - Get prompt
- `PATCH /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Delete prompt
- `POST /api/prompts/:id/apply` - Execute prompt with LLM

### Files

- `POST /api/prompts/:id/files` - Upload files (multipart/form-data)
- `GET /api/prompts/:id/files` - List files
- `GET /api/prompts/:id/files/:fileId/download` - Download file
- `GET /api/prompts/:id/files/:fileId/content` - Get file content as text
- `DELETE /api/prompts/:id/files/:fileId` - Delete file

### Search

- `POST /api/search` - Vector similarity search
- `POST /api/search/related` - Find related prompts
- `POST /api/search/context` - Get RAG context
- `GET /api/search/stats` - Embedding statistics

### Other

- `GET /health` - Health check
- `GET /api/models` - List available LLM models

## Scripts

```bash
# Development
bun run dev              # Start with hot reload
bun run start            # Start production

# Docker
bun run docker:up        # Start services
bun run docker:down      # Stop services
bun run docker:clean     # Remove volumes
bun run docker:logs      # View logs

# Database
bun run db:push          # Push schema changes
bun run db:studio        # Open Drizzle Studio

# Testing
./test-all.sh            # Run all 51 tests
```

## Example Usage

```bash
# Create a prompt
curl -X POST http://localhost:3005/api/prompts \
  -H "Content-Type: application/json" \
  -H "x-domain-id: my-app" \
  -d '{
    "name": "Code Review",
    "prompt": "Review this code for best practices",
    "metadata": {"category": "development"}
  }'

# Upload file
curl -X POST http://localhost:3005/api/prompts/{prompt-id}/files \
  -H "x-domain-id: my-app" \
  -F "files=@code.js"

# Search
curl -X POST http://localhost:3005/api/search \
  -H "Content-Type: application/json" \
  -H "x-domain-id: my-app" \
  -d '{"query": "code review", "limit": 5}'

# Execute with RAG
curl -X POST http://localhost:3005/api/prompts/{prompt-id}/apply \
  -H "Content-Type: application/json" \
  -H "x-domain-id: my-app" \
  -d '{
    "query": "What issues do you see?",
    "useContext": true,
    "modelId": "gpt-4o"
  }'
```

## Architecture

- **Runtime**: Bun (TypeScript)
- **Framework**: Express
- **Database**: PostgreSQL 16 + pgvector 0.8.0
- **Storage**: NextCloud (WebDAV)
- **Embeddings**: OpenAI text-embedding-3-large (3072 dims)
- **LLM**: OpenAI (GPT-4o family)
- **ORM**: Drizzle ORM

## Versioning & Releases

- We follow [Semantic Versioning](https://semver.org/) starting at `0.1.0`; bump
  `MAJOR` for breaking API changes, `MINOR` for backward-compatible features, and
  `PATCH` for fixes.
- Each release is tagged in git as `vMAJOR.MINOR.PATCH` and produces matching
  Docker images (`prompt-tool:MAJOR.MINOR.PATCH`, `MAJOR.MINOR`, `MAJOR`) plus a
  convenience `prompt-tool:latest` tag pointing at the newest successful release.
- Use explicit versioned tags in production deployments; treat `latest` as
  best-effort preview only.
- Keep release notes alongside the tag (for example in the git tag annotation or
  a changelog entry) so consumers can see exactly what changed. See
  [`CHANGELOG.md`](./CHANGELOG.md) for the release history.

## Troubleshooting

**Database connection fails**
```bash
bun run docker:up
# Wait for healthy status
docker-compose ps
```

**Port 3005 already in use**
```bash
lsof -ti:3005 | xargs kill -9
```

**Tests fail with 401 errors**
- Check `.env` has a valid `OPENAI_API_KEY`

**Empty file upload errors**
- Expected behavior - empty files are rejected with 400 status
