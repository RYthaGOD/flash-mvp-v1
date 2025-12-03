# =============================================================================
# FLASH Bridge Frontend - Production Dockerfile
# =============================================================================
# Multi-stage build: Build React app, serve with Nginx
# =============================================================================

# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment
ARG REACT_APP_API_URL=https://api.flash-bridge.com
ARG REACT_APP_SOLANA_NETWORK=mainnet-beta

# Set environment variables
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOLANA_NETWORK=$REACT_APP_SOLANA_NETWORK

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 -G nginx-user && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx-user:nginx-user /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

