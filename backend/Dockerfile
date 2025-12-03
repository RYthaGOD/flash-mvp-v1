# =============================================================================
# FLASH Bridge Backend - Production Dockerfile
# =============================================================================
# Multi-stage build for optimized production image
# =============================================================================

# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Stage 2: Production
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set production environment
ENV NODE_ENV=production

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "src/index.js"]

