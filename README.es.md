# AgentMesh

> 🌍 **Languages:** [English](./README.md) | [Русский](./README.ru.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | [فارسی](./README.fa.md) | [Türkçe](./README.tr.md) | [Español](./README.es.md)

**Gateway de Infraestructura y Plano de Control de Grado de Producción para Agentes de IA**

> API Gateway + Service Mesh + Service Discovery + Message Broker + Observability — construido específicamente para cargas de trabajo agénticas.

AgentMesh se sitúa entre agentes de IA autónomos y proporciona una capa de infraestructura compartida para Discovery, Routing, Authentication, Authorization, Capability Discovery, Delegación de Tareas, Ciclo de Vida, Streaming, Reintentos, Timeouts, Circuit Breaking, Balanceo de Carga, Observabilidad, Rate Limiting, Cuotas, Aislamiento de Tenants, Políticas, Eventos, Ejecución Asíncrona, Intercambio de Artefactos.

A2A es un protocolo de primera clase. Sin reemplazo propietario. MCP puenteado con abstracción clara.

**Completamente gratis para uso personal y comercial — sin archivo de licencia, sin clave de licencia, sin suscripción.**

---

## Arquitectura

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

**Separación Control Plane / Data Plane** — Data Plane continúa con config en caché (Redis) si Control Plane está temporalmente no disponible. Gateway escala horizontalmente sin cuello de botella central.

**Stack:** PostgreSQL (fuente de verdad con fallback InMemory), Redis (cache, health, rate limiting), NATS JetStream (event bus + cola de tareas con fallback), S3-compatible (artefactos, MinIO local).

### Estructura del Repo

```
apps/
  gateway/        # Data Plane - Fastify, stateless, 3+ réplicas, HPA
  control-plane/  # Control Plane - Registry, Tasks, Artifacts, Messages, Webhooks, MCP, Observability
  console/        # Web Console - Next.js 14, Tailwind, shadcn/ui, TanStack Query/Table, React Flow
packages/
  a2a-protocol/   # Tipos A2A, validación, parser de Agent Card
  routing/        # 5 estrategias: round_robin, weighted, least_loaded, latency_aware, capability_match
  tasks/          # Ciclo de vida de tareas + árbol de delegación
  reliability/    # CircuitBreaker, Bulkhead, retry, timeout, deduplicación
  identity/       # ApiKey, JWT, OIDC, mTLS, Workload, Composite
  authorization/  # RBAC/ABAC, políticas, DelegationManager
  ... 16 paquetes + 4 adaptadores
```

---

## Inicio Rápido

### Requisitos
- Node.js 20+, pnpm 9+
- Docker & Docker Compose
- Opcional: kubectl, helm

### 1. Clonar e Instalar

```bash
git clone https://github.com/mmdverse/agentmesh
cd agentmesh
pnpm install
```

### 2. Iniciar Infraestructura

```bash
pnpm docker:up
# Postgres :5432, Redis :6379, NATS :4222 (monitor :8222), MinIO :9000, Console :9001
```

### 3. Configuración

```bash
cp infra/.env.example .env
# Para dev los defaults funcionan con fallback InMemory
```

### 4. Ejecutar Dev

```bash
pnpm dev
# gateway -> http://localhost:3001
# control-plane -> http://localhost:3002
# console -> http://localhost:3000
```

### 5. Health Checks

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

---

## Características

### A2A como Protocolo de Primera Clase
- Agent Cards: caché, validación, seguimiento de versiones, firma, políticas de confianza
- Discovery: Direct URL, Well-Known, Local Registry, Enterprise, DNS, Dynamic, Manual
- Soporte: Messages, Tasks, Artifacts, Streaming (SSE), Push Notifications, Cancelación

### Registro
ID, Name, Description, Organization, Version, Endpoints, Skills, Capabilities, Security Schemes, Health, Region, Tags, Trust Status. Ranking configurable vía plugins RoutingStrategy, sin ranking AI hardcodeado.

### Versionado
Múltiples versiones: CodeAgent v1, v2, v3. Estrategias: latest, stable, specific, minimum, canary, max_satisfying (semver `^1.0.0`). Versionado por tenant.

### Multi-Tenancy
```
Organization -> Projects -> Agents, Tasks, Policies
```
Aislamiento estricto — mismatch de org → 403. Extraído de `X-Organization-Id`, `X-Project-Id`, JWT.

### Orquestación de Tareas
`SUBMITTED → WORKING → INPUT_REQUIRED/AUTH_REQUIRED → COMPLETED/FAILED/CANCELED`. Estado persistente, árbol de delegación con limitador fan-out 10, profundidad 10. Grafo vivo con React Flow.

### Confiabilidad
Reintentos con exponential backoff + jitter, deadlines, Circuit Breakers CLOSED/OPEN/HALF_OPEN, Bulkheads, Idempotency 24h, Deduplicación, sin reintentos ciegos.

### Seguridad (Threat Model Implementado)
Agente malicioso, agente comprometido, Agent Card malicioso, suplantación de identidad, replay, secuestro de tareas, confused deputy, SSRF (bloqueo de IP privadas, solo https en prod), abuso de webhook, bypass de autorización, breakout de tenant, acceso a artefactos, inyección de mensajes, DoS, tormentas de reintento, fuga de credenciales.

### Autenticación y Autorización
ApiKey, JWT (jose), OIDC (JWKS), mTLS, Workload, Composite. RBAC/ABAC, `deny-overrides-allow`, coincidencia glob, verificación de que los scopes hijos son subconjunto del padre contra escalada de privilegios.

### Artefactos, Mensajes, MCP Bridge
S3 (MinIO/AWS) + checksum sha256, URLs prefirmadas. Mensajes sync/async/streaming con traceId. MCP Tool ↔ A2A Skill conversión bidireccional.

### Event Bus y Webhooks
NATS JetStream stream `AGENTMESH` con fallback InMemory. Webhooks firmados HMAC sha256, reintentos, protección SSRF, dead-letter.

### Rate Limiting y Observabilidad
Multidimensional: org 500/s, project 200/s, agent 50/s, IP 100/s, global 1000/s. Token bucket, sliding window. Trazado OTel User→Agent→Tool, métricas latency, errores.

### Consola
Next.js 14, 19 páginas: Agents, Tasks con grafo vivo, Artifacts, Messages, MCP, Security, Telemetry, etc.

---

## API

```
/v1/agents - lista con filtros skill/version/region + tenancy
/v1/agents/discover - descubrimiento con version-aware best
/v1/tasks - creación con delegation + fan-out + bulkhead + circuit breaker
/v1/tasks/:id/graph, /stream (SSE)
/v1/artifacts - ciclo de vida S3
/v1/messages, /webhooks, /mcp, /observability
```

---

## Despliegue

### Docker Compose
```bash
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

### Kubernetes
```bash
kubectl apply -f infra/k8s/
```

### Helm
```bash
helm install agentmesh infra/helm/agentmesh -n agentmesh --create-namespace
```

Sin K8s para desarrollo local — fallback InMemory para todo.

---

## Pruebas

```bash
pnpm test
```

Unit, Integration, A2A Conformance, MCP Bridge, Routing, Task Lifecycle, Failure, Load, Security, Multi-Tenant, Fuzz, Property-Based.

---

## SDK

```ts
const mesh = new AgentMeshClient({ endpoint: "http://localhost:3002", gatewayEndpoint: "http://localhost:3001" });
const agents = await mesh.discovery.find({ skill: "code-review" });
const task = await mesh.tasks.create({ agentId: agents.agents[0].id, message: { text: "Revisa este PR" } });
const result = await mesh.tasks.poll(task.task.id);
```

---

## Soporte y Donaciones

AgentMesh es gratis y abierto — sin condiciones. Una persona mantiene esto, y las donaciones van a costos reales de infraestructura: servidores, medición, tráfico de producción.

**Donaciones Cripto — 100% va a infra:**

- **BTC (Bitcoin):** `bc1q36uzqlkaav3lkscknhemcem0lcjtkhepdqckul`
- **BNB (BSC):** `0x57902d3955D5F1C0fbCaEA0a12A7D691c792487E`
- **SOL (Solana):** `4hCYetZjvK8mkuobRvPYXyRnM84aTj3q8LZ1GpiTK8HR` — comisiones más bajas
- **TRON (TRC20):** `TVFZKSwMYNw1jiCyKKtKoVG3HbpB4DhsA5` — comisiones más bajas

Ver [DONATE.md](./DONATE.md) para detalles. Comisiones más bajas en Solana y Tron.

---

Made ❤️ by Mohammad @llllxyz — https://t.me/llllxyz

Infraestructura para el futuro agéntico.
