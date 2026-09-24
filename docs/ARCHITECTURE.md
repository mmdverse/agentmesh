# AgentMesh Architecture - Phase 0

## Overview

AgentMesh is an Infrastructure Gateway and Control Plane for AI Agents, similar in ambition to an API Gateway or Service Mesh but purpose-built for Agentic Systems.

```
User -> Gateway Cluster (Data Plane) -> Agent A -> Agent B -> MCP Tools
              |
              v
        Control Plane
   Registry / Policy / AuthZ / Config
              |
              v
     Postgres / Redis / NATS / S3
```

## Control Plane / Data Plane Separation

**Control Plane** (stateful):

- Agent Registry, Agent Card management, versioning, health, TTL
- Policies, Authorization, Tenant isolation
- Configuration, Routing rules, Admin API
- Workers for health checks, webhook retries, timeouts

**Data Plane** (stateless):

- Message forwarding, routing, load balancing
- Streaming (SSE), Task lifecycle proxy
- Telemetry, Rate limiting, Circuit breaking
- Can operate with cached config if Control Plane temporarily unavailable

## A2A as First-Class Protocol

No proprietary replacement. A2A spec is versioned in `packages/a2a-protocol`.

Supported:

- Agent Cards, Discovery (well-known, direct URL, registry, DNS)
- Messages, Tasks, Artifacts, Streaming, Push Notifications, Cancellation, Context IDs, Extensions

Gateway acts as: A2A Client, Server, Reverse Proxy, Router, Registry, Policy Enforcement Point.

## Task as Distributed Object

```
SUBMITTED -> WORKING -> INPUT_REQUIRED / AUTH_REQUIRED -> COMPLETED / FAILED / CANCELED / REJECTED / TIMEOUT
```

- Persistent state, history (append-only), edges (delegation tree)
- IDs: rootTaskId, parentTaskId, taskId, agentId, sessionId, contextId, traceId
- Reconstruction of full Execution Graph

## Routing Engine (Two-Stage)

1. Filter: skill, capability, protocol, version, region, health, tenant, policy, availability
2. Score + Strategy: round_robin, weighted, least_loaded, latency_aware, locality_aware, capability_match, version_aware, failover, canary, sticky

Custom Routing Plugin supported via `RoutingStrategy` interface.

## Security

Zero-trust:

- Remote Agent Card never blindly trusted, signature verification, trust policies
- Agent Card is metadata, not authorization
- Webhook: signed, retries with exponential backoff, idempotency, replay protection, SSRF protection, never blindly call arbitrary URL
- AuthN: OAuth/OIDC, Service Credentials, API Keys, mTLS, Workload Identity (pluggable)
- AuthZ: caller identity, agent identity, org/project, skill, task, resource, scope, delegation chain, least privilege
- Delegation: explicit scopes, audience, expiration, parent identity, purpose, revocation, prevent privilege escalation
- Trust levels: UNTRUSTED, EXTERNAL, VERIFIED, ORGANIZATION, SYSTEM - trust is input to policy, not policy itself

Threats covered: malicious agent, compromised agent, spoofed identity, replay, task hijacking, confused deputy, SSRF, webhook abuse, tenant breakout, artifact violations, etc.

## Event Bus

Internal event-driven architecture:

`agent.registered, agent.updated, agent.unhealthy, task.created, task.started, task.completed, task.failed, message.sent, artifact.created, policy.denied`

Abstraction supports Redis Streams, NATS JetStream, Kafka. Phase 0: InMemory, Phase 1: NATS JetStream.

## Observability

OpenTelemetry from day one:

- Every task has trace propagation: User -> Agent A -> Agent B -> Tool
- Metrics: latency, errors, retries, task duration, queue time, agent utilization, success rate, timeouts
- Export to OTel-compatible systems

## Multi-Tenancy

Organization -> Projects -> Agents, Tasks, Policies, Credentials

Strict isolation via RLS + middleware + policy checks.

## Artifact Management

- Types: text, JSON, files, images, structured data, generated docs
- Large artifacts not in Postgres, only reference + metadata in DB, data in S3-compatible storage
- Checksum, content type, size, retention, access control, expiration

## MCP Bridge

A2A Agent <-> AgentMesh <-> MCP Server/Tool

MCP and A2A kept separate, no merging without documented abstraction.

## Gateway Cluster

Horizontally scalable, no central bottleneck, uses Redis, NATS, Postgres for coordination.

## Repository Structure (Improved)

See README.md - Hexagonal architecture, ports and adapters.

## Phases

- Phase 0: Foundation
- Phase 1: Registry + A2A
- Phase 2: Tasks + Routing + Streaming
- Phase 3: Reliability + Security
- Phase 4: Console + SDKs + MCP
- Phase 5: Hardening + Helm
