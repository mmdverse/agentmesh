FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/core/package.json ./packages/core/
COPY packages/a2a-protocol/package.json ./packages/a2a-protocol/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/tasks/package.json ./packages/tasks/
COPY packages/events/package.json ./packages/events/
COPY packages/routing/package.json ./packages/routing/
COPY adapters/postgres/package.json ./adapters/postgres/
COPY adapters/redis/package.json ./adapters/redis/
COPY adapters/nats/package.json ./adapters/nats/
COPY apps/control-plane/package.json ./apps/control-plane/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build --filter=@agentmesh/control-plane...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/control-plane/dist ./apps/control-plane/dist
COPY --from=builder /app/apps/control-plane/package.json ./apps/control-plane/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/adapters ./adapters
EXPOSE 3002
CMD ["node", "apps/control-plane/dist/index.js"]
