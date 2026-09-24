# AgentMesh

> 🌍 **Языки:** [English](./README.md) | [Русский](./README.ru.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | [فارسی](./README.fa.md)

**Production-grade Infrastructure Gateway и Control Plane для AI-агентов**

> API Gateway + Service Mesh + Service Discovery + Message Broker + Observability — создано специально для агентных нагрузок.

AgentMesh находится между автономными AI-агентами и предоставляет общий инфраструктурный слой для Discovery, Routing, Authentication, Authorization, Capability Discovery, Delegation задач, Lifecycle, Streaming, Retries, Timeouts, Circuit Breaking, Load Balancing, Observability, Rate Limiting, Quotas, Tenant Isolation, Policy, Eventing, Async Execution, обмена артефактами.

A2A — протокол первого класса. Никакой проприетарной замены. MCP подключен через четкую абстракцию.

**Полностью бесплатно для личного и коммерческого использования — без лицензионных файлов, ключей и подписок.**

---

## Архитектура

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

**Разделение Control Plane / Data Plane** — Data Plane продолжает работать с кэшированным конфигом (Redis), если Control Plane временно недоступен. Gateway масштабируется горизонтально без центрального узкого места.

**Стек:** PostgreSQL (источник истины, с fallback на InMemory), Redis (кэш, health, rate limiting), NATS JetStream (event bus + очередь задач, с fallback), S3-совместимый (артефакты, MinIO локально).

### Структура репозитория

```
apps/
  gateway/        # Data Plane - Fastify, stateless, 3+ реплики, HPA
  control-plane/  # Control Plane - Registry, Tasks, Artifacts, Messages, Webhooks, MCP, Observability
  console/        # Web Console - Next.js 14, Tailwind, shadcn/ui, TanStack Query/Table, React Flow
packages/
  a2a-protocol/   # A2A типы, валидация, парсер Agent Card
  routing/        # 5 стратегий: round_robin, weighted, least_loaded, latency_aware, capability_match
  tasks/          # Жизненный цикл задач + дерево делегации
  reliability/    # CircuitBreaker, Bulkhead, retry, timeout, deduplication
  identity/       # ApiKey, JWT, OIDC, mTLS, Workload, Composite
  authorization/  # RBAC/ABAC, политики, DelegationManager
  ... 16 пакетов + 4 адаптера (postgres, redis, nats, s3)
```

---

## Быстрый старт

### Требования
- Node.js 20+, pnpm 9+
- Docker & Docker Compose
- Опционально: kubectl, helm

### 1. Клонирование и установка

```bash
git clone https://github.com/mmdverse/agentmesh
cd agentmesh
pnpm install
```

### 2. Запуск инфраструктуры

```bash
pnpm docker:up
# Postgres :5432, Redis :6379, NATS :4222 (мониторинг :8222), MinIO :9000, Console :9001
```

### 3. Конфигурация

```bash
cp infra/.env.example .env
# Для разработки дефолты работают с InMemory fallback
```

### 4. Запуск Dev

```bash
pnpm dev
# gateway -> http://localhost:3001
# control-plane -> http://localhost:3002
# console -> http://localhost:3000
```

### 5. Проверка

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3000/
```

---

## Возможности

### A2A как протокол первого класса
- Agent Cards: кэширование, валидация, версионирование, подпись, trust policies
- Discovery: Direct URL, Well-Known, Local Registry, Enterprise, DNS, Dynamic, Manual
- Поддержка: Messages, Tasks, Artifacts, Streaming (SSE), Push Notifications, Cancellation

### Registry
ID, Name, Description, Organization, Version, Endpoints, Skills, Capabilities, Security Schemes, Health, Region, Tags, Trust Status. Ранжирование через плагины RoutingStrategy.

### Версионирование
Несколько версий: CodeAgent v1, v2, v3. Стратегии: latest, stable, specific, minimum, canary, max_satisfying (semver `^1.0.0`, `~2.0.0`). Per-tenant версионирование.

### Multi-Tenancy
```
Organization -> Projects -> Agents, Tasks, Policies
```
Строгая изоляция — несовпадение org → 403. Извлекается из `X-Organization-Id`, `X-Project-Id`, JWT.

### Оркестрация задач
`SUBMITTED → WORKING → INPUT_REQUIRED/AUTH_REQUIRED → COMPLETED/FAILED/CANCELED`. Persistent state, delegation tree с лимитом fan-out 10, depth 10. Live граф через React Flow.

### Надежность
Retries с exponential backoff + jitter, deadlines, Circuit Breakers CLOSED/OPEN/HALF_OPEN, Bulkheads, Idempotency 24ч, Deduplication, без слепых ретраев.

### Безопасность (Threat Model реализован)
- Вредоносный агент, скомпрометированный агент, поддельный Agent Card, спуфинг, replay, hijacking, confused deputy, SSRF (блок private IP, только https в prod), webhook abuse, обход авторизации, tenant breakout, доступ к артефактам, инъекция сообщений, DoS, retry storms, утечка credentials.

### Аутентификация
ApiKey, JWT (jose), OIDC (JWKS), mTLS, Workload Identity, Composite.

### Авторизация
Caller, agent, org, project, skill, task, scope, policy, delegation chain. `deny-overrides-allow`, glob matching, scopes subset check против escalation.

### Артефакты и сообщения
S3 (MinIO/AWS) + checksum sha256, presigned URLs, retention. Сообщения sync/async/streaming с traceId.

### MCP Bridge
```
A2A Agent | AgentMesh | MCP Server
MCP Tool → A2A Skill, MCP Server → A2A Card, A2A Skill → MCP Tool
```

### Event Bus и Webhooks
NATS JetStream stream `AGENTMESH` с fallback на InMemory. Webhooks подписанные HMAC sha256, ретраи, SSRF защита, dead-letter.

### Rate Limiting и Observability
Multi-dimensional: org 500/s, project 200/s, agent 50/s, IP 100/s, global 1000/s. Token bucket, sliding window. OTel tracing User→Agent→Tool, метрики latency, errors, retries.

### Console
Next.js 14, 19 страниц: Agents, Tasks с живым графом React Flow, Artifacts, Messages, MCP, Security, Telemetry и т.д.

---

## API

```
/v1/agents - список с фильтрами skill/version/region + tenancy
/v1/agents/discover - discovery с version-aware best
/v1/tasks - создание с delegation + fan-out + bulkhead + circuit breaker
/v1/tasks/:id/graph, /stream (SSE)
/v1/artifacts - S3 lifecycle
/v1/messages, /webhooks, /mcp, /observability
/v1/health, /info
```

---

## Деплой

### Docker Compose
```bash
pnpm docker:up   # postgres, redis, nats, minio, control-plane, gateway x2, console
pnpm docker:logs
pnpm docker:down
```

### Kubernetes
```bash
kubectl apply -f infra/k8s/
# Namespace, ConfigMap, Secret, Postgres PVC 10Gi, Redis 5Gi, NATS 5Gi, Gateway 3 реплики HPA 3-10, Control-Plane 2, Console, Ingress
```

### Helm
```bash
helm install agentmesh infra/helm/agentmesh -n agentmesh --create-namespace
helm upgrade agentmesh infra/helm/agentmesh -n agentmesh
```

Без K8s для локальной разработки — InMemory fallback для всего.

---

## Тестирование

```bash
pnpm test
```

Unit, Integration, A2A Conformance, MCP Bridge, Routing, Task Lifecycle, Failure, Load, Security, Multi-Tenant, Fuzz, Property-Based.

---

## SDK

```ts
const mesh = new AgentMeshClient({ endpoint: "http://localhost:3002", gatewayEndpoint: "http://localhost:3001" });
const agents = await mesh.discovery.find({ skill: "code-review", versionStrategy: "stable" });
const task = await mesh.tasks.create({ agentId: agents.agents[0].id, message: { text: "Review PR" } });
const result = await mesh.tasks.poll(task.task.id);
```

---

## Поддержка

Бесплатно и открыто — без условий. Один человек поддерживает проект, донаты идут на реальную инфраструктуру: серверы, измерения, продакшн трафик.

См. [DONATE.md](./DONATE.md) — крипто адреса BTC, BNB, SOL, Tron. Минимальные комиссии на Solana и Tron.

---

Made ❤️ by Mohammad @llllxyz — https://t.me/llllxyz

Инфраструктура для агентного будущего.
