# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package files and install production deps with native module rebuild
COPY package*.json ./
RUN npm install --only=production

# Copy built app
COPY --from=builder /app/build ./build

# Copy migrations for database setup (to /app/migrations for easy access)
COPY --from=builder /app/src/lib/server/migrations ./migrations

# Copy sync worker script
COPY --from=builder /app/scripts ./scripts

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Expose port
EXPOSE 3000

# Health check (using curl, available in alpine)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/fluxarr.db

# Start the app (migrations run automatically on first request via SvelteKit hooks)
CMD ["node", "build"]
