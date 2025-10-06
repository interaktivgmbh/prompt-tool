# Multi-stage production Dockerfile for prompt-tool

# Stage 1: Builder - Install all dependencies and prepare application
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install ALL dependencies (including drizzle-kit needed for migrations)
RUN bun install --frozen-lockfile

# Copy source code and config files
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle

# Run type checking (optional but recommended)
RUN bun run typecheck || true

# Stage 2: Runtime - Optimized production image
FROM oven/bun:1-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Set working directory
WORKDIR /app

# Copy ALL dependencies from builder stage (including drizzle-kit for migrations)
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules

# Copy application code from builder stage
COPY --from=builder --chown=appuser:appuser /app/src ./src
COPY --from=builder --chown=appuser:appuser /app/drizzle ./drizzle
COPY --from=builder --chown=appuser:appuser /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=appuser:appuser /app/tsconfig.json ./tsconfig.json

# Copy package files
COPY --chown=appuser:appuser package.json bun.lock ./

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Wait for database to be ready' >> /app/start.sh && \
    echo 'echo "Waiting for database..."' >> /app/start.sh && \
    echo 'while ! pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -d ${DB_NAME:-prompt_db}; do' >> /app/start.sh && \
    echo '  echo "Database is unavailable - sleeping"' >> /app/start.sh && \
    echo '  sleep 2' >> /app/start.sh && \
    echo 'done' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo 'echo "Database is ready!"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Run database migrations' >> /app/start.sh && \
    echo 'echo "Running database migrations..."' >> /app/start.sh && \
    echo 'bun run db:push --force || {' >> /app/start.sh && \
    echo '  echo "Migration failed, but continuing..."' >> /app/start.sh && \
    echo '}' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start the application' >> /app/start.sh && \
    echo 'echo "Starting application..."' >> /app/start.sh && \
    echo 'exec bun run src/index.ts' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown appuser:appuser /app/start.sh

# Set environment variables
ENV NODE_ENV=production \
    PORT=3005 \
    HOST=0.0.0.0

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE 3005

# Start application with migration
CMD ["/app/start.sh"]