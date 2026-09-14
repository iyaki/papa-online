# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY package*.json ./

# Install dependencies
RUN cd server && npm ci --only=production

# Production stage
FROM node:20-alpine

LABEL org.opencontainers.image.source=https://github.com/iyaki/papa-online

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy application files
COPY server ./server
COPY client ./client
COPY package.json ./

# Bake version identity at build time
ARG APP_VERSION=dev
ARG APP_BUILT_AT=
ENV APP_VERSION=${APP_VERSION}
ENV APP_BUILT_AT=${APP_BUILT_AT}

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start server
CMD ["node", "server/server.js"]
