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

⭐ **[Star 支持](https://github.com/mmdverse/agentmesh/stargazers)** 如果有用 · 💛 **[支持项目](#支持与捐赠)**

_自托管的 AI Agent 基础设施网关和控制平面 — A2A 作为第一类，MCP 桥接，控制台显示实时委派图。_

---

**生产级 AI Agent 基础设施网关与控制平面**

> API 网关 + 服务网格 + 服务发现 + 消息代理 + 可观测性 — 专为 Agent 工作负载打造。

AgentMesh 位于自主 AI Agent 之间，提供共享基础设施层：发现、路由、认证、授权、能力发现、任务委派、生命周期、流式传输、重试、超时、熔断、负载均衡、可观测性、限流、配额、租户隔离、策略、事件、异步执行、产物交换。

A2A 是第一类协议，没有私有替代品。MCP 通过清晰抽象桥接。

**完全免费，个人和商业均可使用 — 无需许可证文件、许可证密钥、订阅。**

---

## 架构

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

**控制平面 / 数据平面分离** — 如果控制平面暂时不可用，数据平面继续使用缓存配置（Redis）。网关无状态，水平扩展，无中心瓶颈。

**技术栈:** PostgreSQL（真实来源，带 InMemory 回退）、Redis（缓存、健康检查、限流）、NATS JetStream（事件总线 + 任务队列，带回退）、S3 兼容（产物，本地用 MinIO）。

### 仓库结构

```
apps/
  gateway/        # 数据平面 - Fastify, 无状态, 3+ 副本, HPA
  control-plane/  # 控制平面 - 注册、任务、产物、消息、Webhooks、MCP、可观测性
  console/        # Web 控制台 - Next.js 14, Tailwind, shadcn/ui, TanStack, React Flow
packages/
  a2a-protocol/   # A2A 类型、验证、Agent Card 解析
  routing/        # 5 种路由策略 round_robin, weighted, least_loaded, latency_aware, capability_match
  tasks/          # 任务生命周期 + 委派树
  reliability/    # 熔断、舱壁、重试、超时、去重
  identity/       # ApiKey, JWT, OIDC, mTLS, Workload
  authorization/  # RBAC/ABAC, 策略, 委派防提权
  ... 16 个包 + 4 个适配器
```

---

## 快速开始

### 环境要求

- Node.js 20+, pnpm 9+
- Docker & Docker Compose
- 可选: kubectl, helm

### 1. 克隆与安装

```bash
git clone https://github.com/mmdverse/agentmesh
cd agentmesh
pnpm install
```

### 2. 启动基础设施

```bash
pnpm docker:up
# Postgres :5432, Redis :6379, NATS :4222 (监控 :8222), MinIO :9000, Console :9001
```

### 3. 配置

```bash
cp infra/.env.example .env
# 开发环境默认配置可直接使用 InMemory 回退
```

### 4. 开发运行

```bash
pnpm dev
# gateway -> http://localhost:3001
# control-plane -> http://localhost:3002
# console -> http://localhost:3000
```

### 5. 健康检查

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

---

## 功能特性

### A2A 作为第一类协议

- Agent Cards: 缓存、验证、版本跟踪、签名、信任策略
- 发现模式: Direct URL, Well-Known, Local Registry, Enterprise, DNS, Dynamic, Manual
- 支持: Messages, Tasks, Artifacts, Streaming (SSE), Push Notifications, Cancellation

### 注册中心

存储 ID, 名称, 描述, 组织, 版本, 端点, Skills, Capabilities, Security Schemes, 健康状态, 区域, 标签, 信任级别。通过 RoutingStrategy 插件排序，无硬编码 AI 排序。

### 版本管理

多版本: CodeAgent v1, v2, v3。策略: latest, stable, specific, minimum, canary, max_satisfying (semver `^1.0.0`)。支持按租户版本。

### 多租户

```
Organization -> Projects -> Agents, Tasks, Policies
```

严格隔离 — org 不匹配 → 403。来自 `X-Organization-Id`, `X-Project-Id`, JWT。

### 任务编排

`SUBMITTED → WORKING → INPUT_REQUIRED/AUTH_REQUIRED → COMPLETED/FAILED/CANCELED`。持久化状态，委派树 fan-out 限制 10，深度 10，React Flow 实时图。

### 可靠性

指数退避 + 抖动重试，超时，熔断器 CLOSED/OPEN/HALF_OPEN，舱壁，24小时幂等，去重，无盲目重试。

### 安全（威胁模型已实现）

恶意 Agent、被入侵 Agent、恶意 Agent Card、身份伪造、重放、任务劫持、混淆代理、SSRF（屏蔽私有 IP，生产仅 https）、Webhook 滥用、授权绕过、租户逃逸、产物访问、消息注入、DoS、重试风暴、凭证泄露。

### 认证与授权

ApiKey, JWT (jose), OIDC (JWKS), mTLS, Workload, Composite。RBAC/ABAC, `deny-overrides-allow`, glob 匹配，子 scope 必须是父 scope 子集防提权。

### 产物、消息、MCP 桥接

S3 (MinIO/AWS) + sha256 校验、预签名 URL。消息 sync/async/streaming 带 traceId。MCP Tool ↔ A2A Skill 双向转换。

### 事件总线与 Webhooks

NATS JetStream `AGENTMESH` 流，带 InMemory 回退。Webhooks HMAC sha256 签名，重试，SSRF 防护，dead-letter。

### 限流与可观测性

多维度: org 500/s, project 200/s, agent 50/s, IP 100/s, global 1000/s。Token bucket, sliding window。OTel 链路 User→Agent→Tool，指标 latency, errors, retries。

### 控制台

Next.js 14, 19 个页面: Agents, Tasks 实时图, Artifacts, Messages, MCP, Security, Telemetry 等。

---

## API

```
/v1/agents - 列表，支持 skill/version/region + 租户过滤
/v1/agents/discover - 版本感知发现
/v1/tasks - 创建，支持委派 + fan-out + 舱壁 + 熔断
/v1/tasks/:id/graph, /stream (SSE)
/v1/artifacts - S3 生命周期
/v1/messages, /webhooks, /mcp, /observability
```

---

## 部署

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

本地开发无需 K8s — 全部 InMemory 回退。

---

## 测试

```bash
pnpm test
```

单元、集成、A2A 一致性、MCP 桥接、路由、任务生命周期、故障、负载、安全、多租户、模糊、属性测试。

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

## 支持与捐赠

完全免费开源，无附加条件。一人维护，捐赠用于真实基础设施成本：服务器、测量、生产流量。

### 地址

用钱包应用扫描卡片，或使用下面的复制按钮。发送前在钱包中检查地址 — Solana 和 Tron 手续费最低。

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

**不是金钱人士？** 一个失败的测试用例、一个新的路由策略或一个测量的延迟配置文件比大多数 PR 更有价值。

---

Made ❤️ by Mohammad @llllxyz — https://t.me/llllxyz

面向 Agent 未来的基础设施。
