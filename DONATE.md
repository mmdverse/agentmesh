# Support AgentMesh

**AgentMesh is completely free — personal use and commercial use, no license file, no license key, no subscription. Use it, ship it, put it inside your company.**

One person maintains this, and every donation goes to the one thing an infrastructure project cannot fake: **real servers, real measurement, real production traffic.**

### Why donate?

AgentMesh is not a toy proxy or a dashboard over an API. It is a full platform:

- API Gateway + Service Mesh + Service Discovery + Message Broker + Observability — built for AI Agents
- Control Plane / Data Plane separation, Gateway Cluster with horizontal scaling, NATS JetStream, Redis coordination, Postgres source of truth, S3 artifacts
- Reliability: Circuit Breakers, Bulkheads, Retries with jitter, Timeouts, Fan-out limits, Idempotency
- Security: ApiKey, JWT, OIDC, mTLS, Workload Identity, Policy Engine with delegation and privilege escalation prevention
- Versioning: semver resolution with latest/stable/canary/minimum/range
- Multi-tenancy: strict org/project isolation
- Messaging: sync/async/streaming with trace propagation
- Artifacts: S3-compatible with lifecycle and access control
- MCP Bridge: A2A ↔ MCP translation with clear protocol separation
- Webhooks: signed delivery, retries, SSRF protection, dead-letter
- Observability: OpenTelemetry tracing User → Agent A → Agent B → Tool, metrics for latency, errors, retries, queue time
- Web Console: Next.js, Tailwind, shadcn/ui, TanStack Query/Table, React Flow live task graph

Running this in production costs real money: Postgres, Redis, NATS, S3, multiple gateway nodes, telemetry storage, CI, and continuous testing against real agent workloads. Donations keep the infrastructure honest.

- **Vantage points.** VPS instances, so the gateway cluster runs with real latency and failure modes, not loopback.
- **Bigger samples.** Real artifact sizes, real streaming durations, real fan-out explosions measured in production.
- **Keeping it alive.** CI, test machines, and the maintenance hours.

### Addresses

Scan a card with your wallet app, or use the copy button under it. Check the address in your wallet before sending — network fees are lowest on Solana and Tron.

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

No platform takes a cut. Funds go directly to the maintainer.

**Not a money person?** A failing test case, a new routing strategy, or a measured latency profile is worth more than most PRs.

Made ❤️ by Mohammad @llllxyz — https://t.me/llllxyz

Infrastructure for the agentic future.
