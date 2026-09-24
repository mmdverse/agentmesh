FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/core/package.json ./packages/core/
COPY packages/a2a-protocol/package.json ./packages/a2a-protocol/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/routing/package.json ./packages/routing/
COPY packages/tasks/package.json ./packages/tasks/
COPY packages/events/package.json ./packages/events/
COPY packages/artifacts/package.json ./packages/artifacts/
COPY packages/identity/package.json ./packages/identity/
COPY packages/authorization/package.json ./packages/authorization/
COPY packages/reliability/package.json ./packages/reliability/
COPY packages/rate-limit/package.json ./packages/rate-limit/
COPY packages/versioning/package.json ./packages/versioning/
COPY packages/tenancy/package.json ./packages/tenancy/
COPY packages/messaging/package.json ./packages/messaging/
COPY packages/mcp-bridge/package.json ./packages/mcp-bridge/
COPY packages/webhooks/package.json ./packages/webhooks/
COPY packages/observability/package.json ./packages/observability/
COPY adapters/postgres/package.json ./adapters/postgres/
COPY adapters/redis/package.json ./adapters/redis/
COPY adapters/nats/package.json ./adapters/nats/
COPY adapters/s3/package.json ./adapters/s3/
COPY adapters/oidc/package.json ./adapters/oidc/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/control-plane/package.json ./apps/control-plane/
COPY apps/console/package.json ./apps/console/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/adapters ./adapters
COPY . .
RUN pnpm turbo run build --filter=@agentmesh/gateway... --concurrency=1

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/apps/gateway/package.json ./apps/gateway/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/adapters ./adapters
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "apps/gateway/dist/index.js"]
