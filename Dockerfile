# ==========================================
# FlowCart Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Frontend Build
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

# Install server production dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

# Copy server application source code
COPY server/ ./

# Copy built frontend assets from client-builder stage
COPY --from=client-builder /app/client/dist /app/client/dist

# Create persistent data volume directory and assign permissions to non-root user
RUN mkdir -p /data && chown -R node:node /data /app

# Switch to non-root user for security
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
