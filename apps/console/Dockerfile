FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY packages/a2a-protocol/package.json ./packages/a2a-protocol/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/console/package.json ./apps/console/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm turbo run build --filter=@agentmesh/console... --concurrency=1

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/console/.next ./apps/console/.next
COPY --from=builder /app/apps/console/package.json ./apps/console/
COPY --from=builder /app/apps/console/next.config.js ./apps/console/
COPY --from=builder /app/apps/console/public ./apps/console/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
WORKDIR /app/apps/console
