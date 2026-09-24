# AgentMesh

> 🌍 **Languages:** [English](./README.md) | [Русский](./README.ru.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | [فارسی](./README.fa.md)

**Production-grade Infrastructure Gateway and Control Plane for AI Agents**

> API Gateway + Service Mesh + Service Discovery + Message Broker + Observability — purpose-built for Agentic Workloads.

AgentMesh sits between autonomous AI Agents and provides a shared infrastructure layer for Discovery, Routing, Authentication, Authorization, Capability Discovery, Task Delegation, Lifecycle, Streaming, Retries, Timeouts, Circuit Breaking, Load Balancing, Observability, Rate Limiting, Quotas, Tenant Isolation, Policy, Eventing, Async Execution, Artifact Exchange.

A2A is a first-class protocol. No proprietary replacement. MCP bridged with clear abstraction.

**Completely free for personal and commercial use — no license file, no license key, no subscription.**

---

## Architecture

```
                ┌─────────────────────────────────┐
                │        Control Plane            │
                │  Registry / Policies / AuthZ    │
                │  Artifacts / Messages / Webhooks│
                │  MCP Bridge / Observability     │
                └──────────┬──────────────────────┘
                           │ cached config + NATS
                ┌──────────▼──────────────────────┐
                │          Data Plane             │
                │  Gateway Cluster (stateless)    │
                │  Routing / Streaming / Forward  │
                │  Circuit Breaker / Bulkhead     │
                │  Rate Limit / Tenant Isolation  │
                └──┬────────┬────────┬────────┬───┘
                   │        │        │        │
              Agent A   Agent B  Agent C  MCP Tools
```

**Control Plane / Data Plane separation** — Data Plane continues with cached config (Redis) if Control Plane is temporarily unavailable. Gateway scales horizontally with no central bottleneck.

**Stack:** PostgreSQL (source of truth, with InMemory fallback), Redis (cache, health, rate limiting, coordination), NATS JetStream (event bus + task queue, with InMemory fallback), S3-compatible (artifacts, MinIO for local).

### Repository Structure

```
apps/
  gateway/        # Data Plane - Fastify, stateless, 3+ replicas, HPA
  control-plane/  # Control Plane - Registry, Tasks, Artifacts, Messages, Webhooks, MCP, Observability
  console/        # Web Console - Next.js 14, Tailwind, shadcn/ui, TanStack Query/Table, React Flow

packages/
  a2a-protocol/   # A2A types, validation, Agent Card parser, fetcher with discovery
  core/           # Task State Machine, IDs, Errors, Tenancy types
  routing/        # Routing Engine + 5 strategies (round_robin, weighted, least_loaded, latency_aware, capability_match)
  tasks/          # Task lifecycle, state machine, delegation tree builder
  events/         # Event Bus - InMemory + NATS JetStream with fallback
  artifacts/      # Artifact Manager - S3 + InMemory, checksum, retention, access control
  messaging/      # Message Router - sync/async/streaming, trace propagation
  webhooks/       # Webhook Manager - signed, retry, SSRF protection, dead-letter
  mcp-bridge/     # MCP Bridge - A2A <-> MCP translation
  observability/  # OTel tracing User->Agent->Tool, metrics
  telemetry/      # OpenTelemetry SDK setup + observability integration
  identity/       # Auth providers - ApiKey, JWT (jose), OIDC (JWKS), mTLS, Workload, Composite
  authorization/  # Policy engine, RBAC/ABAC, DelegationManager with escalation prevention
  reliability/    # CircuitBreaker, Bulkhead, retry, timeout, Deduplicator, Idempotency, FanOutLimiter
  rate-limit/     # TokenBucket, FixedWindow, SlidingWindow, MultiDimensionalRateLimiter, ResourceLimits
  versioning/     # Semver parsing, compare, stable/canary check, range, VersionResolver
  tenancy/        # TenantContext, TenantManager strict isolation, hierarchy validation
  sdk/            # Client SDK - discovery, tasks, artifacts, messages, webhooks, mcp, observability, streaming
  server-sdk/     # Agent Server SDK - Fastify server, JSON-RPC, SSE, auth hooks, telemetry

adapters/
  postgres/       # Drizzle ORM + migrations
  redis/          # Redis client with fallback, RedisCache
  nats/           # NATS JetStream client, stream AGENTMESH creation
  s3/             # S3 client + S3ArtifactStore with presigned URLs
  oidc/           # OIDC adapter

infra/
  docker-compose.yml  # Full stack: postgres, redis, nats, minio, control-plane, gateway x2, console
  k8s/                # Namespace, ConfigMap, Secret, Postgres, Redis, NATS, Gateway (3 replicas, HPA), Control-Plane (2), Console, Ingress
  helm/agentmesh/     # Helm chart with dependencies, values for all components, HPA, Ingress
```

---

## Quick Start

### Prerequisites
- Node.js 20+, pnpm 9+
- Docker & Docker Compose (for infra)
- Optional: kubectl, helm for K8s

### 1. Clone & Install

```bash
git clone https://github.com/mmdverse/agentmesh
cd agentmesh
pnpm install
```

### 2. Start Infrastructure (Postgres, Redis, NATS, MinIO)

```bash
pnpm docker:up
# Postgres :5432, Redis :6379, NATS :4222 (monitor :8222), MinIO :9000, MinIO Console :9001
# Buckets auto-created: agentmesh-artifacts
```

### 3. Configure Env

```bash
cp infra/.env.example .env
# Edit .env if needed - JWT_SECRET, OIDC, etc.
# For dev, defaults work with InMemory fallbacks
```

### 4. Run Dev (all apps)

```bash
pnpm dev
# gateway -> http://localhost:3001
# control-plane -> http://localhost:3002
# console -> http://localhost:3000
```

Or individually:

```bash
pnpm --filter @agentmesh/gateway dev
pnpm --filter @agentmesh/control-plane dev
pnpm --filter @agentmesh/console dev
```

### 5. Health Checks

```bash
curl http://localhost:3001/health
curl http://localhost:3001/v1/health
curl http://localhost:3002/health
curl http://localhost:3002/v1/health
curl http://localhost:3000/
```

---

## Features

### A2A as First-Class Protocol

- Agent Cards: caching (Redis), validation (Zod), version tracking, invalidation, signature verification, trust policies, public/private cards, authenticated extended cards
- Discovery Modes: Direct URL, Well-Known, Local Registry, Enterprise Registry, DNS/Service Discovery, Dynamic, Manual - pluggable DiscoveryProvider
- Supported: Agent Cards, Discovery, Skills, Capabilities, Security Schemes, Messages, Tasks, Artifacts, Streaming (SSE), Push Notifications (webhooks), Cancellation, Task State, Context Identifiers, Extensions
- Gateway roles: A2A Client, Server, Reverse Proxy, Router, Registry, Policy Enforcement Point

### Agent Registry

Stores: Agent ID, Name, Description, Organization, Version, Protocol Versions, Endpoints, Transports, Skills, Capabilities, Security Schemes, Health, Region, Environment, Tags, Metadata, Trust Status

Supports: registration, deregistration, discovery, versioning, health checks, metadata updates, TTL, heartbeat, capability filtering

Ranking configurable via RoutingStrategy plugins - no hardcoded AI ranking.

### Versioning

- Multiple versions: CodeAgent v1, v2, v3
- Strategies: latest, stable, specific version, minimum version, canary, max_satisfying (semver range ^1.0.0, ~2.0.0, >=1.0.0 <2.0.0)
- Compatibility rules: same major compatible (semver), explicit rules override
- Per-tenant versioning: same name, different versions per org/project

### Multi-Tenancy

```
Organization
  +-- Projects
       +-- Agents, Tasks, Policies, Credentials
```

Strict isolation enforced - org mismatch → 403, project mismatch → 403. Extracted from X-Organization-Id, X-Project-Id headers, query, body, JWT claims.

### Task Orchestration

Lifecycle: SUBMITTED → WORKING → INPUT_REQUIRED/AUTH_REQUIRED → COMPLETED/FAILED/CANCELED/REJECTED/TIMEOUT

Persistent state, task creation/lookup/cancellation/retry/resume/timeout/ownership/history/metadata/correlation, long-running support.

Distributed Execution: rootTaskId, parentTaskId, taskId, agentId, sessionId, contextId, traceId tracked. Full execution graph reconstructable. Delegation tree with fan-out limiter (max 10), depth limit (10).

Live Task Graph via React Flow with real-time updates, node click shows identity, status, latency, messages, artifacts, permissions, trace, errors.

### Reliability (Production Distributed Systems)

- Retries with exponential backoff + jitter
- Deadlines, timeouts (withTimeout)
- Circuit Breakers CLOSED/OPEN/HALF_OPEN per agent/key with stats
- Bulkheads with maxConcurrent + queue, tryAcquire/release
- Concurrency limits, queue limits, backpressure
- Idempotency (IdempotencyStore 24h), Deduplication (Deduplicator with TTL)
- Request cancellation
- No blind retries - considers task semantics

### Security

**Threat Model Implemented:**

- Malicious agent - trust levels UNTRUSTED/EXTERNAL/VERIFIED/ORGANIZATION/SYSTEM, trust is input to policy, not policy itself
- Compromised agent - circuit breaker, health UNHEALTHY
- Malicious Agent Card - schema validation, no blind trust, signature verification
- Spoofed identity - auth verification
- Replay - webhook timestamp tolerance, idempotency keys
- Task hijacking - tenant isolation, delegation chain
- Confused deputy - explicit delegation with scopes/audience/expiration
- SSRF - URL allowlist, blocked private IPs (10., 192.168., 172.16-31., 127., 0., localhost, ::1, 169.254.169.254), metadata blocked, only https in prod
- Webhook abuse - signing, retries, dead-letter
- Authorization bypass - deny-overrides-allow, glob matching
- Tenant breakout - strict isolation
- Artifact access - private/public/org/project access control
- Message injection - content-type validation, size limits
- Oversized payloads - 1MB message, 100MB artifact
- DoS - multi-dimensional rate limiting, bulkhead, fan-out limiter
- Retry storms - backoff + jitter + circuit breaker
- Credential leakage - env-based, no logging
- Malicious extension - plugin interfaces
- Compromised gateway - horizontal scaling, no central bottleneck

### Authentication

Pluggable AuthProvider: OAuth/OIDC (JWKS remote), Service Credentials, API Credentials (X-API-Key, Bearer), mTLS (CN extraction), Workload Identity (X-Workload-Identity). Composite tries in order. Avoid long-lived credentials.

### Authorization

Independent subsystem considering caller identity, agent identity, organization, project, skill, task, resource scope, policy, delegation chain. Example: Agent A can research.read but not production.deploy. Least privilege. Policy schema with effect allow/deny, subjects/resources/actions with glob, conditions (trustLevel, org), priority, isActive, org/project scoping. Delegation with scopes, audience, expiration, chain, revocation, privilege escalation prevention (child scopes subset of parent).

### Message Routing

Message: messageId, sender, receiver, taskId, contextId, sessionId, traceId, correlationId, parentMessageId, timestamp, contentType, payload, metadata. Sync/async/streaming, transport abstraction (InMemory, future NATS/Kafka).

### Artifact Management

Artifacts: text, JSON, files, images, structured data, generated documents. Stored in S3-compatible (MinIO, AWS S3), only reference + metadata in DB. Supports checksum (sha256), contentType, size, retention, access control, expiration, tags, presigned URLs, cleanupExpired.

### MCP Bridge

```
A2A Agent | AgentMesh | MCP Server/Tool
MCP-based Agent | AgentMesh | A2A Agent
```

MCP Tool → A2A Skill (id: mcp_{name}, tags), MCP Server → A2A Agent Card, A2A Skill → MCP Tool (inputSchema). Protocol concerns separate, no blind merge. InMemoryMCPClient for testing with tool handlers.

### Event Bus

Events: agent.registered, agent.updated, agent.unhealthy, agent.deleted, task.created, task.started, task.completed, task.failed, task.canceled, message.sent, message.received, artifact.created, policy.denied, webhook.delivered/failed

Abstraction supports Redis Streams, NATS, Kafka. Production: NATS JetStream with stream AGENTMESH, subjects agentmesh.>, retention 24h, memory storage, durable consumers, fallback to InMemory. Also InMemoryEventBus for dev/tests.

### Push Notifications

Secure webhook delivery: signed (HMAC sha256 t=timestamp,v1=hmac), retries (3 default, exponential backoff 2^attempt + jitter, max 30s), idempotency (Idempotency-Key), replay protection (timestamp tolerance 5m), delivery tracking, dead-letter, webhook validation, SSRF protection. Never blindly calls arbitrary URL.

### Rate Limiting

Multi-dimensional: organization (500/s), project (200/s), agent (50/s), identity (100/s), skill (100/s), endpoint, task, IP (100/s), global (1000/s). Strategies: fixed_window, sliding_window, token_bucket. Configurable limits: requests/sec, concurrent tasks, task duration, artifact size, message size. 429 with Retry-After + X-RateLimit headers.

### Resource Limits

Protects against huge messages, huge artifacts, excessive streaming, unbounded tasks, retry storms, fan-out explosions. Configurable: maxMessageSize 1MB, maxArtifactSize 100MB, maxConcurrentTasks 100, maxTaskDuration 30m, maxStreaming 1h, maxFanOut 10, maxRetries 3. 413 on oversize.

### Observability

OpenTelemetry with OTLP exporter. Trace propagation: User → Agent A → Agent B → Tool via X-Trace-Id, traceId, spanId, parentSpanId. Spans with attributes, events, status, duration. Metrics: latency, errors, retries, task duration, queue time, agent utilization, success rate, timeouts. InMemoryTracer for dev with getTrace, getMetrics, exportTrace OTel-compatible. Gateway and Control Plane plugins auto-trace requests.

### Web Console

Next.js 14, TypeScript, React 18, Tailwind, shadcn/ui, TanStack Query, TanStack Table, React Flow.

Pages: Overview, Agent Registry, Agent Details, Agent Card, Skills, Tasks, Task Detail, Live Task Graph (React Flow real-time), Messages, Artifacts, Routes, Routing Policies, Organizations, Projects, Credentials, Security Events (threat model + webhook deliveries), Telemetry (spans, metrics, traces), System Health, Configuration.

Infrastructure-grade UI, not generic admin.

### SDKs

**Client SDK:**

```ts
const mesh = new AgentMeshClient({ endpoint: "http://localhost:3002", gatewayEndpoint: "http://localhost:3001" });
const agents = await mesh.discovery.find({ skill: "code-review", versionStrategy: "stable" });
const task = await mesh.tasks.create({ agentId: agents.agents[0].id, message: { text: "Review this code" } });
const result = await mesh.tasks.poll(task.task.id);
const artifact = await mesh.artifacts.create({ contentType: "application/json", jsonData: { result }, taskId: task.task.id });
```

Supports: discovery with versioning, agents CRUD, tasks create/get/list/cancel/complete/fail/retry/history/graph/stream (SSE) + polling fallback, artifacts create/getData/list/delete/presignedUrl, messages send/get/list/ack, webhooks register/list/delete/deliveries/test, mcp listServers/discover/registerServer/callTool, observability getTrace/getMetrics/getSpans, gateway route/invoke, health.

**Server SDK:**

```ts
const server = createAgentServer({
  card: { name: "CodeAgent", description: "Reviews code", version: "1.0.0", skills: [...] },
  taskHandler: async (ctx) => {
    return { text: `Reviewed: ${ctx.message.text}`, state: "COMPLETED" };
  },
});
server.addSkill({ id: "code-review", name: "Code Review", description: "Reviews", tags: ["code"] }, async (ctx) => {
  ctx.stream?.({ text: "Analyzing..." });
  return { text: "LGTM" };
});
await server.listen(); // Fastify server with /.well-known/agent.json, JSON-RPC, SSE, auth hooks, telemetry
```

Supports: task handlers, streaming via ctx.stream, artifacts, auth hooks (onAuth, onAuthorize), middleware, telemetry.

---

## API

Versioned Management API:

```
/v1/agents - list with skill/capability/version/region/search + tenant + versioning
/v1/agents/discover - composite discovery with version-aware best
/v1/agents/versions/:name - list versions
/v1/agents/:id - get with tenant isolation
/v1/agents/:id/card - get card with caching
/v1/agents/:id/health - health
/v1/agents/:id/heartbeat - heartbeat
/v1/tasks - create with tenant + delegation + fan-out + bulkhead + circuit breaker
/v1/tasks/:id - get
/v1/tasks/:id/cancel, /complete, /fail, /retry
/v1/tasks/:id/history, /graph, /stream (SSE)
/v1/tasks/reliability/stats - breakers, bulkheads, fan-out
/v1/artifacts - create/list with S3 lifecycle
/v1/artifacts/:id, /:id/data, /:id/url
/v1/messages - send/list/get/ack with trace
/v1/webhooks - register/list/delete + deliveries + test with SSRF protection
/v1/mcp/servers, /discover, /servers/:name/tools/:toolName/call, /bridge/a2a-to-mcp
/v1/observability/traces/:traceId, /metrics, /spans
/v1/health, /info
/v1/routes, /policies (placeholders)
```

OpenAPI will be generated (Phase 5). Typed client via SDK.

---

## Deployment

### Docker Compose (Single Node + Small Cluster)

```bash
pnpm docker:up
# Full stack: postgres, redis, nats, minio, control-plane, gateway x2 (HA), console
pnpm docker:logs
pnpm docker:down
```

Compose includes: healthchecks, volumes (pgdata, redisdata, natsdata, miniodata), network agentmesh-network, env from .env, replicas for gateway cluster.

### Kubernetes (Enterprise Cluster)

```bash
kubectl apply -f infra/k8s/
# Namespace agentmesh, ConfigMap, Secret, Postgres (PVC 10Gi), Redis (5Gi), NATS (JetStream 5Gi), Gateway Deployment 3 replicas + HPA 3-10 CPU 70%, Control Plane 2 replicas, Console, Ingress (nginx, agentmesh.local, gateway.agentmesh.local, control-plane.agentmesh.local)
kubectl get pods -n agentmesh
kubectl logs -f deployment/gateway -n agentmesh
```

Manifests: namespace.yaml, postgres.yaml, redis.yaml, nats.yaml, gateway.yaml (with HPA), control-plane.yaml, console.yaml, ingress.yaml

### Helm (Enterprise)

```bash
helm install agentmesh infra/helm/agentmesh -n agentmesh --create-namespace
# With dependencies: postgresql 12.12.10, redis 18.6.5, nats 0.19.1 (JetStream), minio
helm upgrade agentmesh infra/helm/agentmesh -n agentmesh
helm uninstall agentmesh -n agentmesh
```

Values: replicaCount (gateway 3, controlPlane 2, console 1), images, service type ClusterIP, ingress enabled, resources (gateway 1Gi, controlPlane 1Gi, console 512Mi), autoscaling (gateway 3-10 CPU 70% memory 80%), config (nodeEnv, databaseUrl, redisUrl, natsUrl, s3, jwtSecret, limits), secrets, postgresql/redis/nats/minio enabled.

### Single Node

Use Docker Compose with 1 gateway replica, or `pnpm dev` for local without K8s.

### Small Cluster

Compose with gateway x2, or K8s with 3 gateway + 2 control-plane.

### Enterprise Cluster

K8s with HPA, Helm with external Postgres/Redis/NATS/S3.

No K8s required for local dev - InMemory fallbacks for all infra.

---

## Testing

```bash
pnpm test
pnpm turbo run test
```

**Test Coverage (Phase 5):**

- Unit Tests: core state machine, versioning semver, tenancy isolation, rate limiting, reliability primitives, messaging, webhooks SSRF/signing, MCP translation, observability tracing
- Integration Tests: registry CRUD with tenant, tasks with fan-out + bulkhead, artifacts lifecycle, messages with trace, webhooks delivery, gateway proxy with circuit breaker, control-plane with authz
- A2A Conformance: Agent Card validation, discovery, messages, tasks, artifacts, streaming, cancellation
- MCP Bridge Tests: A2A->MCP and MCP->A2A translation, tool handlers
- Routing Tests: 5 strategies, version-aware, tenant-aware, health-aware
- Task Lifecycle Tests: SUBMITTED→WORKING→COMPLETED/FAILED, retry, delegation tree
- Failure Tests: Agent unhealthy, Gateway unavailable, NATS unavailable, Redis unavailable, DB failover, duplicate messages/webhooks, network latency, partial failures
- Load Tests: concurrent tasks, rate limiting, bulkhead queue, fan-out explosion prevention
- Security Tests: auth providers, policy engine, SSRF, tenant breakout, artifact access, oversized payloads, signing verification
- Multi-Tenant Tests: org/project isolation, cross-tenant denial, super-admin bypass
- Fuzz Tests: message injection, artifact metadata, webhook URLs
- Property-Based: version comparison, rate limit counting

Simulate: Agent unavailable (circuit OPEN), Gateway unavailable (cached config fallback), NATS unavailable (InMemory fallback), Redis unavailable (InMemory fallback), DB failover (InMemory), duplicate messages (Deduplicator), duplicate webhooks (Idempotency), latency, partial failures.

---

## Documentation

- README (this file) - Architecture, Quick Start, Features, API, Deployment, Testing
- Architecture - Control Plane / Data Plane, Gateway Cluster, Event Bus, Storage
- A2A Architecture - Protocol as first-class, adapter versioning
- MCP Bridge - A2A ↔ MCP with separation
- Agent Registration, Discovery, Routing, Tasks, Streaming, Artifacts
- Security Threat Model, Authentication, Authorization, Delegation
- Deployment - Docker, Kubernetes, Helm, single-node, small cluster, enterprise
- SDK, Server SDK, Plugin Development
- Operations, Troubleshooting, Contributing, Security Policy, Changelog

Docs live in `docs/` (future) and inline in code + console UI.

---

## Open Source Quality

- **Completely free** - personal and commercial, no license file, no key, no subscription
- Contributing: see CONTRIBUTING.md
- Security: see SECURITY.md - threat model implemented, not just documented
- Code of Conduct: see CODE_OF_CONDUCT.md
- Changelog: see CHANGELOG.md
- GitHub Actions: Lint, Typecheck, Unit Tests, Integration Tests, Protocol Tests, Security Scanning, Dependency Audit, Container Scanning, Build, Release (future)
- Semantic Versioning: 0.1.0-phase0 → phase5 → 1.0.0

---

## Engineering Principles

- No monolith - modular packages, adapters, apps
- Protocol logic separate from infrastructure logic
- Control Plane separate from Data Plane
- No DB in hot path - Redis cache, NATS queue, cached config fallback
- No central bottleneck - Gateway stateless, horizontally scalable, HPA 3-10
- Never trust all agents - trust levels, health checks, circuit breakers
- Never assume same capabilities - capability filtering, versioning, routing strategies
- No proprietary A2A replacement - standards implemented, infrastructure on top

---

## Final Product

AgentMesh is:

- A2A Gateway
- Agent Registry with versioning + tenancy
- Agent Discovery Service (skill, capability, version, region, health)
- Agent Router with 5 strategies + version + tenant awareness
- Task Orchestration Layer with delegation tree + streaming + reliability
- Agent Service Mesh (circuit breaker, bulkhead, rate limit, observability)
- Agent Observability Layer (OTel tracing User→Agent→Tool, metrics)
- MCP Bridge (A2A ↔ MCP)
- Enterprise Agent Control Plane (registry, policies, identity, artifacts, messages, webhooks, observability, console)

Engineering ambition similar to API Gateway / Service Mesh, but purpose-built for Agentic Systems. Full platform, not MVP.

---

## SDK Example

```ts
import { createClient } from "@agentmesh/sdk";

const mesh = new AgentMeshClient({ endpoint: "http://localhost:3002", gatewayEndpoint: "http://localhost:3001" });

const agents = await mesh.discovery.find({ skill: "code-review", versionStrategy: "stable" });

const task = await mesh.tasks.create({
  agentId: agents.agents[0].id,
  message: { text: "Review this PR" },
});

task.task.id // task_xxx

// Streaming
const es = mesh.tasks.stream(task.task.id, (event, data) => {
  console.log(event, data);
});

// Polling fallback
const completed = await mesh.tasks.poll(task.task.id);
console.log(completed.output);

// Artifacts
const artifact = await mesh.artifacts.create({
  contentType: "application/json",
  jsonData: { review: "LGTM" },
  taskId: task.task.id,
});
```

**Server SDK:**

```ts
import { createAgentServer } from "@agentmesh/server-sdk";

const server = createAgentServer({
  card: { name: "CodeAgent", description: "Reviews code", version: "1.0.0", provider: { organization: "Acme" } },
  skills: [{ id: "code-review", name: "Code Review", description: "Reviews code", tags: ["code"] }],
  taskHandler: async (ctx) => {
    ctx.stream?.({ text: "Analyzing..." });
    return { text: `Reviewed: ${ctx.message.text}`, state: "COMPLETED" };
  },
});

await server.listen();
```

---

## Support

AgentMesh is free and open - no strings. One person maintains this, and donations go to real infrastructure costs: servers, measurement, production traffic.

See [DONATE.md](./DONATE.md) for crypto addresses (BTC, BNB, SOL, Tron) - network fees lowest on Solana and Tron.

---

Made ❤️ by Mohammad @llllxyz — https://t.me/llllxyz

Infrastructure for the agentic future.
