# AgentMesh

**Infrastructure Gateway and Control Plane for AI Agents**

> API Gateway + Service Mesh + Service Discovery + Message Broker + Observability — purpose-built for Agentic Workloads.

AgentMesh sits between autonomous AI Agents and provides a shared infrastructure layer for:

- Discovery, Routing, AuthN/Z, Capability Discovery
- Task Delegation, Lifecycle, Streaming, Retries, Timeouts
- Circuit Breaking, Load Balancing, Rate Limiting, Quotas
- Tenant Isolation, Policy, Eventing, Async Execution, Artifact Exchange

A2A (Agent-to-Agent) is a first-class protocol. No proprietary replacement.

---

## Architecture

```
                ┌─────────────────────────────────┐
                │        Control Plane            │
                │  Registry / Policies / AuthZ    │
                │  Config / Admin API / Workers   │
                └──────────┬──────────────────────┘
                           │ cached config
                ┌──────────▼──────────────────────┐
                │          Data Plane             │
                │  Gateway Cluster (stateless)    │
                │  Routing / Streaming / Forward  │
                └──┬────────┬────────┬────────┬───┘
                   │        │        │        │
              Agent A   Agent B  Agent C  MCP Tools
```

**Control Plane / Data Plane separation** — Data Plane continues with cached config if Control Plane is temporarily unavailable.

**Core stack:** PostgreSQL (source of truth), Redis (cache, health, rate limit, coordination), NATS JetStream (event bus + task queue), S3-compatible storage (artifacts).

### Repo Structure

```
apps/
  gateway/        # Data Plane - Fastify, stateless, edge
  control-plane/  # Control Plane - Registry, Policies, Admin API
  console/        # Web Console - Next.js + shadcn + React Flow

packages/
  a2a-protocol/   # A2A types, validation, Agent Card parser (versioned)
  core/           # Task State Machine, IDs, Errors, Domain Types
  routing/        # Routing Engine + Strategies (pluggable)
  tasks/          # Task lifecycle & delegation tree
  events/         # Event Bus abstraction
  artifacts/      # Artifact storage abstraction
  telemetry/      # OpenTelemetry setup
  config/         # Zod env validation
  sdk/            # Client SDK
  server-sdk/     # Agent Server SDK

adapters/
  postgres/       # Drizzle ORM + migrations
  redis/
  nats/
  s3/
  oidc/

infra/
  docker-compose.yml
  k8s/ & helm/
```

## Quick Start (Phase 0)

### Prerequisites
- Node.js 20+, pnpm 9+
- Docker & Docker Compose

### 1. Clone & Install
```bash
git clone https://github.com/mmdverse/agentmesh
cd agentmesh
pnpm install
```

### 2. Start Infrastructure
```bash
pnpm docker:up
# Postgres :5432, Redis :6379, NATS :4222, MinIO :9000, MinIO Console :9001
```

### 3. Configure Env
```bash
cp infra/.env.example .env
# edit .env if needed
```

### 4. Run Dev
```bash
pnpm dev
# gateway -> http://localhost:3001
# control-plane -> http://localhost:3002
# console -> http://localhost:3000 (Phase 4)
```

### Health Checks
```bash
curl http://localhost:3001/health
curl http://localhost:3001/v1/health
curl http://localhost:3002/health
curl http://localhost:3002/v1/health
```

## A2A Compliance

AgentMesh implements A2A as first-class:

- Agent Cards (caching, validation, versioning, signature verification)
- Discovery (direct URL, well-known, local/enterprise registry, DNS)
- Messages, Tasks, Artifacts, Streaming (SSE), Push Notifications (secure webhooks), Cancellation, Context IDs

Remote Agent Card is never blindly trusted. Card is metadata, not authorization.

## Security Model

Threat model covers: malicious/compromised agent, spoofed identity, replay, task hijacking, confused deputy, SSRF, webhook abuse, tenant breakout, artifact violations, DoS, retry storms, credential leakage.

Controls are implemented, not just documented.

## Roadmap

- **Phase 0 (current):** Foundation - Turborepo, Fastify, Drizzle, OTel, Docker Compose, CI
- **Phase 1:** A2A Protocol + Agent Registry + Discovery
- **Phase 2:** Task Orchestration + Routing Engine + Streaming
- **Phase 3:** Reliability (retries, circuit breaker, timeouts) + Security (AuthN/Z, multi-tenancy)
- **Phase 4:** Web Console + SDKs + MCP Bridge
- **Phase 5:** Hardening - load, chaos, fuzz, Helm

## Open Source

- License: Apache 2.0
- Contributing: see CONTRIBUTING.md
- Security: see SECURITY.md
- Code of Conduct: see CODE_OF_CONDUCT.md

Made with ❤️ by Mohammad (@llllxyz) - https://t.me/llllxyz

---

## Development

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Database

```bash
pnpm db:generate
pnpm db:migrate
```

## Documentation

Full docs will live in `docs/` and `apps/docs/` (Phase 4). For now see `infra/` and package READMEs.

