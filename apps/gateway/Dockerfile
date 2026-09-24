FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/core/package.json ./packages/core/
COPY packages/a2a-protocol/package.json ./packages/a2a-protocol/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/routing/package.json ./packages/routing/
COPY packages/events/package.json ./packages/events/
COPY packages/artifacts/package.json ./packages/artifacts/
COPY adapters/redis/package.json ./adapters/redis/
COPY apps/gateway/package.json ./apps/gateway/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build --filter=@agentmesh/gateway...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/apps/gateway/package.json ./apps/gateway/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/adapters ./adapters
EXPOSE 3001
CMD ["node", "apps/gateway/dist/index.js"]
