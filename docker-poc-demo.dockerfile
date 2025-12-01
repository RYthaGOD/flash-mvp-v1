# FLASH Bridge - POC Demo Docker Image
# Enterprise-grade technical proof with visual frontend integration

FROM node:18-alpine

# Install system dependencies including browser support
RUN apk add --no-cache \
    git \
    curl \
    bash \
    chromium \
    chromium-chromedriver \
    && rm -rf /var/cache/apk/*

# Set environment variables for browser automation
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Change ownership of working directory to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Copy package files for dependency installation
COPY --chown=nodejs:nodejs package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm run install:all

# Copy all project files
COPY . .

# Create necessary directories
RUN mkdir -p backend/logs frontend/build

# Set environment variables for enterprise demo
ENV NODE_ENV=production
ENV REACT_APP_API_URL=http://localhost:3001
ENV FLASH_BRIDGE_MXE_PROGRAM_ID=CULoJigMJeVrmXVYPu8D9pdmfjAZnzdAwWvTqWvz1XkP
ENV ARCIUM_CLUSTER_ID=devnet_default_cluster
ENV ARCIUM_NODE_OFFSET=555666777

# Expose ports for frontend and backend
EXPOSE 3000 3001

# Health check with enterprise monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Enterprise demo command - comprehensive system validation
CMD ["node", "demo-poc.js"]
