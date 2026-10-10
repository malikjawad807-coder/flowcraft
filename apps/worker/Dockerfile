# ==========================================
# FlowCart Worker - Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

COPY package*.json ./
COPY apps/worker/package.json ./apps/worker/
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

# Build all packages and worker
RUN npm run build

# Prune dev dependencies for production image
RUN npm prune --omit=dev

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker ./apps/worker

RUN chown -R node:node /app

USER node

CMD ["node", "apps/worker/dist/index.js"]
