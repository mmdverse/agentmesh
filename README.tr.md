# AgentMesh

> 🌍 **Languages:** [English](./README.md) | [Русский](./README.ru.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | [فارسی](./README.fa.md) | [Türkçe](./README.tr.md) | [Español](./README.es.md)

**AI Agent'leri için Üretim Seviyesi Altyapı Gateway ve Control Plane**

> API Gateway + Service Mesh + Service Discovery + Message Broker + Observability — Agentic iş yükleri için özel olarak tasarlandı.

AgentMesh, otonom AI Agent'leri arasında oturur ve Discovery, Routing, Authentication, Authorization, Capability Discovery, Task Delegation, Lifecycle, Streaming, Retries, Timeouts, Circuit Breaking, Load Balancing, Observability, Rate Limiting, Quotas, Tenant Isolation, Policy, Eventing, Async Execution, Artifact Exchange için paylaşılan bir altyapı katmanı sağlar.

A2A birinci sınıf bir protokoldür. Tescilli bir alternatif yok. MCP net bir soyutlama ile köprülenmiştir.

**Kişisel ve ticari kullanım için tamamen ücretsiz — lisans dosyası yok, lisans anahtarı yok, abonelik yok.**

---

## Mimari

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

**Control Plane / Data Plane ayrımı** — Control Plane geçici olarak kullanılamıyorsa Data Plane önbelleğe alınmış config (Redis) ile devam eder. Gateway yatay olarak ölçeklenir, merkezi darboğaz yok.

**Stack:** PostgreSQL (gerçek kaynak, InMemory fallback ile), Redis (cache, health, rate limiting), NATS JetStream (event bus + task queue, fallback ile), S3-uyumlu (artifact'lar, lokalde MinIO).

### Repo Yapısı

```
apps/
  gateway/        # Data Plane - Fastify, stateless, 3+ replica, HPA
  control-plane/  # Control Plane - Registry, Tasks, Artifacts, Messages, Webhooks, MCP, Observability
  console/        # Web Console - Next.js 14, Tailwind, shadcn/ui, TanStack Query/Table, React Flow
packages/
  a2a-protocol/   # A2A tipleri, doğrulama, Agent Card parser
  routing/        # 5 strateji: round_robin, weighted, least_loaded, latency_aware, capability_match
  tasks/          # Görev yaşam döngüsü + delegasyon ağacı
  reliability/    # CircuitBreaker, Bulkhead, retry, timeout, deduplication
  identity/       # ApiKey, JWT, OIDC, mTLS, Workload, Composite
  authorization/  # RBAC/ABAC, politikalar, DelegationManager
  ... 16 paket + 4 adaptör
```

---

## Hızlı Başlangıç

### Gereksinimler
- Node.js 20+, pnpm 9+
- Docker & Docker Compose
- Opsiyonel: kubectl, helm

### 1. Klonlama ve Kurulum

```bash
git clone https://github.com/mmdverse/agentmesh
cd agentmesh
pnpm install
```

### 2. Altyapıyı Başlatma

```bash
pnpm docker:up
# Postgres :5432, Redis :6379, NATS :4222 (monitor :8222), MinIO :9000, Console :9001
```

### 3. Yapılandırma

```bash
cp infra/.env.example .env
# Dev için varsayılanlar InMemory fallback ile çalışır
```

### 4. Dev Çalıştırma

```bash
pnpm dev
# gateway -> http://localhost:3001
# control-plane -> http://localhost:3002
# console -> http://localhost:3000
```

### 5. Sağlık Kontrolü

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

---

## Özellikler

### A2A Birinci Sınıf Protokol Olarak
- Agent Cards: önbellekleme, doğrulama, versiyon takibi, imza, trust politikaları
- Discovery: Direct URL, Well-Known, Local Registry, Enterprise, DNS, Dynamic, Manual
- Destek: Messages, Tasks, Artifacts, Streaming (SSE), Push Notifications, Cancellation

### Registry
ID, Name, Description, Organization, Version, Endpoints, Skills, Capabilities, Security Schemes, Health, Region, Tags, Trust Status. RoutingStrategy eklentileri ile sıralama, hardcoded AI sıralaması yok.

### Versiyonlama
Çoklu versiyonlar: CodeAgent v1, v2, v3. Stratejiler: latest, stable, specific, minimum, canary, max_satisfying (semver `^1.0.0`). Tenant başına versiyonlama.

### Multi-Tenancy
```
Organization -> Projects -> Agents, Tasks, Policies
```
Sıkı izolasyon — org uyuşmazlığı → 403. `X-Organization-Id`, `X-Project-Id`, JWT'den çıkarılır.

### Görev Orkestrasyonu
`SUBMITTED → WORKING → INPUT_REQUIRED/AUTH_REQUIRED → COMPLETED/FAILED/CANCELED`. Kalıcı durum, fan-out sınırlayıcı 10, derinlik 10 ile delegasyon ağacı. React Flow ile canlı grafik.

### Güvenilirlik
Exponential backoff + jitter ile retry, deadline, Circuit Breaker CLOSED/OPEN/HALF_OPEN, Bulkhead, Idempotency 24s, Deduplication, kör retry yok.

### Güvenlik (Tehdit Modeli Uygulandı)
Kötü niyetli agent, ele geçirilmiş agent, kötü niyetli Agent Card, kimlik sahteciliği, replay, task hijacking, confused deputy, SSRF (özel IP blok, prod'da sadece https), webhook suistimali, yetkilendirme bypass, tenant breakout, artifact erişimi, mesaj enjeksiyonu, DoS, retry fırtınaları, kimlik bilgisi sızıntısı.

### Kimlik Doğrulama ve Yetkilendirme
ApiKey, JWT (jose), OIDC (JWKS), mTLS, Workload, Composite. RBAC/ABAC, `deny-overrides-allow`, glob eşleştirme, ayrıcalık yükseltmesini önlemek için child scope'ların parent'ın alt kümesi olması kontrolü.

### Artifact'lar, Mesajlar, MCP Bridge
S3 (MinIO/AWS) + sha256 checksum, presigned URL. Mesajlar sync/async/streaming traceId ile. MCP Tool ↔ A2A Skill çift yönlü dönüşüm.

### Event Bus ve Webhooks
NATS JetStream `AGENTMESH` stream, InMemory fallback ile. Webhook'lar HMAC sha256 imzalı, retry, SSRF koruması, dead-letter.

### Rate Limiting ve Gözlemlenebilirlik
Çok boyutlu: org 500/s, project 200/s, agent 50/s, IP 100/s, global 1000/s. Token bucket, sliding window. OTel tracing User→Agent→Tool, latency, error metrikleri.

### Console
Next.js 14, 19 sayfa: Agents, Tasks canlı grafik, Artifacts, Messages, MCP, Security, Telemetry vb.

---

## API

```
/v1/agents - skill/version/region + tenancy filtreli liste
/v1/agents/discover - versiyon farkındalıklı discovery
/v1/tasks - delegation + fan-out + bulkhead + circuit breaker ile oluşturma
/v1/tasks/:id/graph, /stream (SSE)
/v1/artifacts - S3 yaşam döngüsü
/v1/messages, /webhooks, /mcp, /observability
```

---

## Dağıtım

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

Lokal geliştirme için K8s gerekmez — her şey için InMemory fallback.

---

## Test

```bash
pnpm test
```

Unit, Integration, A2A Conformance, MCP Bridge, Routing, Task Lifecycle, Failure, Load, Security, Multi-Tenant, Fuzz, Property-Based.

---

## SDK

```ts
const mesh = new AgentMeshClient({ endpoint: "http://localhost:3002", gatewayEndpoint: "http://localhost:3001" });
const agents = await mesh.discovery.find({ skill: "code-review" });
const task = await mesh.tasks.create({ agentId: agents.agents[0].id, message: { text: "Bu PR'i incele" } });
const result = await mesh.tasks.poll(task.task.id);
```

---

## Destek ve Bağış

AgentMesh ücretsiz ve açık — hiçbir şart yok. Tek bir kişi tarafından sürdürülüyor ve bağışlar gerçek altyapı maliyetlerine gidiyor: sunucular, ölçüm, üretim trafiği.

**Kripto Bağışları — %100 altyapıya:**

- **BTC (Bitcoin):** `bc1q36uzqlkaav3lkscknhemcem0lcjtkhepdqckul`
- **BNB (BSC):** `0x57902d3955D5F1C0fbCaEA0a12A7D691c792487E`
- **SOL (Solana):** `4hCYetZjvK8mkuobRvPYXyRnM84aTj3q8LZ1GpiTK8HR` — en düşük komisyon
- **TRON (TRC20):** `TVFZKSwMYNw1jiCyKKtKoVG3HbpB4DhsA5` — en düşük komisyon

Detaylar için [DONATE.md](./DONATE.md) bakın. En düşük komisyon Solana ve Tron'da.

---

Made ❤️ by Mohammad @llllxyz — https://t.me/llllxyz

Ajan geleceği için altyapı.
