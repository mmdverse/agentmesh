# AgentMesh

> 🌍 **Languages:** [English](./README.md) | [Русский](./README.ru.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | [فارسی](./README.fa.md) | [Türkçe](./README.tr.md) | [Español](./README.es.md)

[![AgentMesh Banner](./docs/assets/agentmesh-banner.svg)](./docs/assets/agentmesh-banner.svg)

[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](./apps/console)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](./tsconfig.base.json)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](./apps/gateway)
[![A2A Protocol](https://img.shields.io/badge/A2A-first--class-6366f1)](./packages/a2a-protocol)
[![MCP Bridge](https://img.shields.io/badge/MCP-bridge-8b5cf6)](./packages/mcp-bridge)
[![Tests](https://img.shields.io/badge/tests-28%20packages-2ea043)](./packages)
[![Languages](https://img.shields.io/badge/languages-7%20%E2%80%A2%20RTL%20%2B%20LTR-1f6feb)](./README.fa.md)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)](./infra/docker-compose.yml)
[![License](https://img.shields.io/badge/license-free-lightgrey)](./DONATE.md)
[![Version](https://img.shields.io/badge/version-1.0.0-6366f1)](./package.json)

⭐ **[ضع نجمة](https://github.com/mmdverse/agentmesh/stargazers)** إذا كان مفيداً · 💛 **[ادعم المشروع](#الدعم-والتبرع)**

_بوابة بنية تحتية ومنصة تحكم ذاتية الاستضافة لوكلاء الذكاء الاصطناعي — مع A2A كدرجة أولى، MCP مجسّر، وحدة تحكم تعرض الرسم الحي للتفويض._

---

**بوابة بنية تحتية ومنصة تحكم إنتاجية لوكلاء الذكاء الاصطناعي**

> API Gateway + Service Mesh + Service Discovery + Message Broker + Observability — مصمم خصيصاً لأحمال الوكلاء.

AgentMesh يجلس بين وكلاء الذكاء الاصطناعي المستقلين ويوفر طبقة بنية تحتية مشتركة للاكتشاف، التوجيه، المصادقة، التفويض، اكتشاف القدرات، تفويض المهام، دورة الحياة، البث، إعادة المحاولة، المهلات، قاطع الدائرة، موازنة الحمل، المراقبة، تحديد المعدل، الحصص، عزل المستأجرين، السياسات، الأحداث، التنفيذ غير المتزامن، تبادل القطع الأثرية.

A2A هو بروتوكول من الدرجة الأولى. لا بديل احتكاري. MCP مجسّر عبر تجريد واضح.

**مجاني تماماً للاستخدام الشخصي والتجاري — لا ملف ترخيص، لا مفتاح ترخيص، لا اشتراك.**

---

## المعمارية

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

**فصل Control Plane / Data Plane** — يستمر Data Plane بالعمل مع التكوين المخزن (Redis) إذا كان Control Plane غير متاح مؤقتاً. Gateway قابل للتوسع أفقياً بدون عنق زجاجة مركزي.

**المكدس:** PostgreSQL (مصدر الحقيقة مع fallback InMemory)، Redis (cache, health, rate limiting)، NATS JetStream (event bus + task queue مع fallback)، S3-compatible (artifacts, MinIO محلياً).

### هيكل المستودع

```
apps/
  gateway/        # Data Plane - Fastify, stateless, 3+ نسخ, HPA
  control-plane/  # Control Plane - Registry, Tasks, Artifacts, Messages, Webhooks, MCP
  console/        # Web Console - Next.js 14, Tailwind, shadcn/ui, TanStack, React Flow
packages/
  a2a-protocol/   # أنواع A2A, تحقق, محلل Agent Card
  routing/        # 5 استراتيجيات: round_robin, weighted, least_loaded, latency_aware, capability_match
  tasks/          # دورة حياة المهام + شجرة التفويض
  reliability/    # CircuitBreaker, Bulkhead, retry, timeout
  identity/       # ApiKey, JWT, OIDC, mTLS, Workload
  authorization/  # RBAC/ABAC, سياسات, منع تصعيد الصلاحيات
```

---

## البدء السريع

### المتطلبات

- Node.js 20+, pnpm 9+
- Docker & Docker Compose
- اختياري: kubectl, helm

### 1. استنساخ وتثبيت

```bash
git clone https://github.com/mmdverse/agentmesh
cd agentmesh
pnpm install
```

### 2. تشغيل البنية التحتية

```bash
pnpm docker:up
# Postgres :5432, Redis :6379, NATS :4222, MinIO :9000
```

### 3. الإعداد

```bash
cp infra/.env.example .env
# للبيئة التطويرية الإعدادات الافتراضية تعمل مع InMemory fallback
```

### 4. تشغيل التطوير

```bash
pnpm dev
# gateway -> http://localhost:3001
# control-plane -> http://localhost:3002
# console -> http://localhost:3000
```

### 5. فحص الصحة

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

---

## المميزات

### A2A كبروتوكول من الدرجة الأولى

- Agent Cards: تخزين مؤقت, تحقق, تتبع الإصدارات, توقيع, سياسات الثقة
- الاكتشاف: Direct URL, Well-Known, Local Registry, Enterprise, DNS, Dynamic, Manual
- الدعم: Messages, Tasks, Artifacts, Streaming (SSE), Push Notifications, Cancellation

### السجل (Registry)

ID, Name, Description, Organization, Version, Endpoints, Skills, Capabilities, Security Schemes, Health, Region, Tags, Trust Status. الترتيب عبر إضافات RoutingStrategy.

### الإصدارات

إصدارات متعددة: CodeAgent v1, v2, v3. استراتيجيات: latest, stable, specific, minimum, canary, max_satisfying (semver). إصدارات لكل مستأجر.

### متعدد المستأجرين

```
Organization -> Projects -> Agents, Tasks, Policies
```

عزل صارم — عدم تطابق org → 403. من `X-Organization-Id`, `X-Project-Id`, JWT.

### تنسيق المهام

`SUBMITTED → WORKING → INPUT_REQUIRED/AUTH_REQUIRED → COMPLETED/FAILED/CANCELED`. حالة دائمة, شجرة تفويض مع حد fan-out 10, عمق 10. رسم حي عبر React Flow.

### الموثوقية

إعادة محاولة مع backoff أسي + jitter, مهلات, قواطع دوائر CLOSED/OPEN/HALF_OPEN, حواجز, Idempotency 24ساعة, إزالة التكرار.

### الأمان (نموذج التهديد مطبق)

وكيل ضار, وكيل مخترق, بطاقة وكيل ضارة, انتحال هوية, إعادة تشغيل, اختطاف مهام, deputy مرتبك, SSRF (حظر IP خاصة, https فقط في الإنتاج), إساءة webhook, تجاوز تفويض, هروب مستأجر, وصول القطع, حقن رسائل, DoS, عواصف إعادة المحاولة, تسريب بيانات اعتماد.

### المصادقة والتفويض

ApiKey, JWT, OIDC (JWKS), mTLS, Workload, Composite. RBAC/ABAC, `deny-overrides-allow`, مطابقة glob, فحص subset للـ scopes ضد تصعيد الصلاحيات.

### القطع الأثرية والرسائل وMCP Bridge

S3 (MinIO/AWS) + checksum sha256, URLs موقعة. رسائل sync/async/streaming مع traceId. MCP Tool ↔ A2A Skill تحويل ثنائي.

### حافلة الأحداث وWebhooks

NATS JetStream stream `AGENTMESH` مع fallback InMemory. Webhooks موقعة HMAC sha256, إعادة محاولة, حماية SSRF, dead-letter.

### تحديد المعدل والمراقبة

متعدد الأبعاد: org 500/s, project 200/s, agent 50/s, IP 100/s, global 1000/s. Token bucket, sliding window. تتبع OTel User→Agent→Tool, مقاييس latency, errors.

### وحدة التحكم

Next.js 14, 19 صفحة: Agents, Tasks مع رسم حي, Artifacts, Messages, MCP, Security, Telemetry.

---

## API

```
/v1/agents - قائمة مع فلاتر skill/version/region + tenancy
/v1/agents/discover - اكتشاف مع version-aware
/v1/tasks - إنشاء مع delegation + fan-out + bulkhead + circuit breaker
/v1/tasks/:id/graph, /stream (SSE)
/v1/artifacts - دورة حياة S3
/v1/messages, /webhooks, /mcp, /observability
```

---

## النشر

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

لا حاجة لـ K8s للتطوير المحلي — fallback InMemory لكل شيء.

---

## الاختبار

```bash
pnpm test
```

Unit, Integration, A2A Conformance, MCP Bridge, Routing, Task Lifecycle, Failure, Load, Security, Multi-Tenant, Fuzz, Property-Based.

---

## SDK

```ts
const mesh = new AgentMeshClient({
  endpoint: "http://localhost:3002",
  gatewayEndpoint: "http://localhost:3001",
});
const agents = await mesh.discovery.find({ skill: "code-review" });
const task = await mesh.tasks.create({
  agentId: agents.agents[0].id,
  message: { text: "Review PR" },
});
const result = await mesh.tasks.poll(task.task.id);
```

---

## الدعم والتبرع

مجاني ومفتوح تماماً — بدون شروط. شخص واحد يصون المشروع, التبرعات تذهب لتكاليف بنية تحتية حقيقية: خوادم, قياس, ترافيك إنتاجي.

### العناوين

امسح البطاقة بتطبيق المحفظة، أو استخدم زر النسخ تحتها. تحقق من العنوان في محفظتك قبل الإرسال — أقل رسوم على Solana و Tron.

[![Bitcoin · BTC mainnet](./docs/assets/donate/donate-bitcoin.svg)](./docs/assets/donate/donate-bitcoin.svg)

```
bc1q36uzqlkaav3lkscknhemcem0lcjtkhepdqckul
```

[![BNB Smart Chain · BEP-20](./docs/assets/donate/donate-bnb.svg)](./docs/assets/donate/donate-bnb.svg)

```
0x57902d3955D5F1C0fbCaEA0a12A7D691c792487E
```

[![Solana · SOL mainnet](./docs/assets/donate/donate-solana.svg)](./docs/assets/donate/donate-solana.svg)

```
4hCYetZjvK8mkuobRvPYXyRnM84aTj3q8LZ1GpiTK8HR
```

[![Tron · TRC-20](./docs/assets/donate/donate-tron.svg)](./docs/assets/donate/donate-tron.svg)

```
TVFZKSwMYNw1jiCyKKtKoVG3HbpB4DhsA5
```

**لست شخصاً مادياً؟** حالة فاشلة أو استراتيجية توجيه جديدة أو ملف تأخير مقاس أغلى من معظم PRs.

---

Made ❤️ by Mohammad @llllxyz — https://t.me/llllxyz

بنية تحتية لمستقبل الوكلاء.
