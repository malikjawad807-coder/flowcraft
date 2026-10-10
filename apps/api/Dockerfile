# ==========================================
# FlowCart API - Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/agent/package.json ./packages/agent/
COPY packages/db/package.json ./packages/db/
COPY packages/engine/package.json ./packages/engine/
COPY packages/gmail/package.json ./packages/gmail/
COPY packages/llm/package.json ./packages/llm/
COPY packages/nodes/package.json ./packages/nodes/
COPY packages/shared/package.json ./packages/shared/
COPY packages/vault/package.json ./packages/vault/

RUN npm ci

COPY . .

# Build all packages and API
RUN npm run build

# Prune dev dependencies for production image
RUN npm prune --omit=dev

# Stage 2: Production Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

# Copy runtime node_modules, compiled packages, and entrypoint
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/deploy/entrypoint-api.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh && chown -R node:node /app

USER node

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["./entrypoint.sh"]
