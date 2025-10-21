# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] – Initial release

### Added

- Bun/Express service that exposes prompt CRUD endpoints with multi-tenant
  domain isolation (`x-domain-id` header).
- Nextcloud-backed file storage with upload validation, streaming downloads, and
  text extraction for PDF/Markdown/HTML/JSON attachments.
- Embedding pipeline using OpenAI `text-embedding-3-large`, pgvector storage, and
  synchronous reindexing on prompt or file changes.
- Vector search API for similarity queries, related prompt discovery, and
  context assembly to support retrieval-augmented generation.
- Prompt apply service that combines prompt text, optional retrieved context,
  and OpenAI chat completions to return HTML-preserving responses with token
  usage metrics.
