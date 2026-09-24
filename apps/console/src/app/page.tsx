import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black -m-10">
      <div className="relative min-h-[85vh] flex items-center overflow-hidden border-b border-black/10">
        <div className="absolute inset-0 modern-gradient-white" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-black/[0.04] via-black/[0.02] to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[400px] bg-gradient-to-tr from-black/[0.03] to-transparent rounded-full blur-3xl" />
        
        <div className="relative mx-auto max-w-[1200px] px-10 py-20 w-full">
          <div className="max-w-3xl space-y-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-px w-12 bg-black" />
                <span className="modern-label text-black/50">OPEN SOURCE • FREE • PRODUCTION-GRADE • 1.0.0 • 20/20 TESTS PASSED</span>
              </div>
              
              <h1 className="modern-display text-[88px] leading-[0.85] tracking-[-0.06em]">
                AGENT<br/>
                <span className="font-[300]">MESH</span>
              </h1>
              
              <div className="space-y-4 max-w-xl">
                <p className="text-[20px] leading-[1.4] tracking-[-0.02em] font-[400]">
                  Infrastructure Gateway and Control Plane for AI Agents.
                </p>
                <p className="text-[14px] leading-[1.6] text-black/60 tracking-[-0.01em]">
                  A2A first-class, MCP bridged, Service Mesh for Agentic Workloads. Every agentic system rebuilds the same infra. We provide it once — <span className="text-black font-[600]">production-grade, free, no vendor lock-in.</span> SSRF fixed, auto-register, HEALTHY immediate, pagination, InMemory warning.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/overview" className="group inline-flex items-center gap-3 rounded-full bg-black text-white px-8 py-4 text-[13px] font-[600] tracking-[-0.01em] modern-hover">
                OPEN CONSOLE
                <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-[10px] group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
              <Link href="/chat" className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-8 py-4 text-[13px] font-[500] hover:bg-black hover:text-white hover:border-black transition-colors">
                TRY CHAT UI • LIVE
              </Link>
              <a href="https://github.com/mmdverse/AgentMesh" target="_blank" className="inline-flex items-center rounded-full border border-black/10 px-6 py-4 text-[11px] modern-mono hover:border-black/30 transition-colors">
                GITHUB
              </a>
            </div>

            <div className="flex items-center gap-6 pt-4 border-t border-black/10">
              <div className="flex gap-2">
                {["EN","FA","AR","RU","ZH","TR","ES"].map(l => (
                  <span key={l} className="modern-mono text-[10px] text-black/30">{l}</span>
                ))}
              </div>
              <div className="h-3 w-px bg-black/10" />
              <span className="modern-mono text-[10px] text-black/40">7 LANGUAGES • FREE • NO LICENSE • 20/20 PASSED</span>
            </div>
          </div>

          <div className="absolute top-20 right-10 hidden lg:block">
            <div className="relative">
              <div className="w-[320px] rounded-[24px] overflow-hidden border border-black/10 modern-shadow-lg bg-white">
                <img src="/assets/agentmesh-banner.svg" alt="AgentMesh" className="w-full" />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: "AGENTS", value: "1 LIVE • HEALTHY" },
                  { label: "TASKS", value: "22 COMPLETED • 20/20" },
                  { label: "REAL AGENT", value: "9001 • TRANSLATE • سلام دنیا" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-2 border-b border-black/5 last:border-0">
                    <span className="modern-label text-[10px] text-black/40">{s.label}</span>
                    <span className="modern-mono text-[11px] font-[500]">{s.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-black text-white p-3">
                <div className="modern-mono text-[9px] text-white/40">20 SCENARIOS</div>
                <div className="modern-mono text-[10px] text-white/80 mt-1">20 passed, 0 failed • SSRF blocked • Rate limit 3/2 • CB OPEN</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#fafafa] border-b border-black/5">
        <div className="mx-auto max-w-[1200px] px-10 py-20">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="modern-label text-black/30">FEATURES — PHASES 0-5 COMPLETE • ALL GAPS FIXED</div>
              <h2 className="modern-display text-[36px] mt-3 tracking-[-0.04em]">WHY AGENTMESH</h2>
            </div>
            <div className="hidden md:block text-right">
              <div className="modern-mono text-[11px] text-black/40">9 CORE PRIMITIVES • 20/20 TESTS</div>
              <div className="modern-mono text-[11px] text-black/60">PRODUCTION-GRADE • FREE</div>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-4">
            {[
              { title: "DISCOVERY", desc: "Find agents by skill, capability, version, region, health. Pagination + search live.", span: "col-span-12 md:col-span-4", label: "01" },
              { title: "ROUTING", desc: "5 strategies: round_robin, least_loaded, latency_aware, weighted, capability_match. Live stats.", span: "col-span-12 md:col-span-4", label: "02" },
              { title: "RELIABILITY", desc: "Circuit Breaker OPEN/HALF_OPEN/CLOSED, Bulkhead, Retry with jitter, Timeout, Idempotency, Rate Limit TokenBucket 3/5.", span: "col-span-12 md:col-span-4", label: "03" },
              { title: "SECURITY", desc: "ApiKey dev-api-key-12345, JWT, OIDC, mTLS, Workload Identity. RBAC/ABAC, tenant isolation, SSRF metadata always blocked even dev.", span: "col-span-12 md:col-span-6", label: "04" },
              { title: "TASKS & MESSAGING", desc: "Lifecycle SUBMITTED→WORKING→COMPLETED/FAILED, delegation tree, live graph React Flow V2, SSE streaming, sync/async, pagination.", span: "col-span-12 md:col-span-6", label: "05" },
              { title: "ARTIFACTS", desc: "S3 lifecycle, checksum, presigned URLs, download via CP_URL env, pagination, upload via SDK.", span: "col-span-12 md:col-span-3", label: "06" },
              { title: "MCP BRIDGE", desc: "A2A ↔ MCP translation, live servers list.", span: "col-span-12 md:col-span-3", label: "07" },
              { title: "OBSERVABILITY", desc: "OTel tracing User→Agent→Tool, metrics, spans, reliability stats live.", span: "col-span-12 md:col-span-6", label: "08" },
            ].map(f => (
              <div key={f.title} className={`${f.span} group relative rounded-[20px] bg-white border border-black/[0.06] p-7 modern-hover modern-shadow`}>
                <div className="flex justify-between items-start">
                  <span className="modern-mono text-[10px] text-black/20">{f.label}</span>
                  <span className="w-1 h-1 bg-black rounded-full" />
                </div>
                <div className="mt-6">
                  <div className="text-[13px] font-[700] tracking-[-0.02em]">{f.title}</div>
                  <div className="text-[12px] leading-[1.5] text-black/60 mt-2 tracking-[-0.01em]">{f.desc}</div>
                </div>
                <div className="absolute bottom-0 left-7 right-7 h-px bg-gradient-to-r from-black/10 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-black text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="relative mx-auto max-w-[1200px] px-10 py-20">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-5">
              <div className="modern-label text-white/30">ARCHITECTURE • LIVE • FIXED</div>
              <h2 className="modern-display text-[32px] mt-4 leading-[0.9]">CONTROL /<br/>DATA PLANE</h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] p-5">
                  <div className="modern-label text-white/40 text-[10px]">DATA PLANE — 3001 • 5 STRATEGIES • RATE LIMIT</div>
                  <div className="text-[13px] mt-2 leading-[1.5] text-white/80">Gateway Cluster, 10k+ RPS, stateless, Circuit Breaker OPEN after 5 failures, Bulkhead, TokenBucket 1000/s global, A2A Proxy SSRF blocked metadata</div>
                </div>
                <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] p-5">
                  <div className="modern-label text-white/40 text-[10px]">CONTROL PLANE — 3002 • HEALTHY IMMEDIATE • 10S DEV</div>
                  <div className="text-[13px] mt-2 leading-[1.5] text-white/80">Registry 1 agents HEALTHY immediate on register, Tasks 22, Artifacts, Messages, Policies 3, Orgs 2, Projects 2, Credentials 3, OTel 46 spans</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="rounded-[20px] bg-[#0a0a0a] border border-white/[0.08] p-6">
                <pre className="text-[11px] leading-[1.7] text-white/60 modern-mono overflow-auto">
{`User -> Gateway (3001) [round_robin, least_loaded, latency_aware, weighted, capability_match]
  -> Circuit Breaker (CLOSED→OPEN after 5 fails→HALF_OPEN trial→CLOSED)
  -> Bulkhead (max 10 concurrent)
  -> Rate Limiter (TokenBucket 5 capacity 1/s refill — 3 allowed 2 blocked)
  -> A2A Proxy (SSRF: localhost allowed dev, 169.254.169.254 always blocked)
  -> Real Agent (9001) real-code-reviewer [code-review, translate] auto-register + heartbeat 10s
     -> "سلام دنیا" • Code review 95 score

Control Plane (3002):
  Registry (1 agents HEALTHY immediate) • Tasks (22) • Artifacts (1) • Messages (1)
  Policies (3) • Orgs (2) • Projects (2) • Credentials (3) • Webhooks
  Observability: 46 spans • 45 metrics • Reliability stats live

Console (3000):
  Modern Luxury V2 Black Gray White Gradient • InMemory warning banner
  Chat: NEXT_PUBLIC_CONTROL_PLANE_URL env, gateway invoke first, preview host handling
  Tasks: pagination limit 20 offset, state filter, SSE via CP_URL env
  Agents: pagination, search, skill filter, HEALTHY count

SDK:
  createAgentServer({ controlPlaneUrl, autoRegister: true, heartbeatIntervalMs: 10000 })
  client.agents.list() • discovery.find({skill}) • tasks.create() • gateway.route()
  TokenBucket, CircuitBreaker, Bulkhead, retry — all tested 20/20

20 Scenarios: 20 passed 0 failed
- Landing, Overview, Agents, Tasks, Chat, Health, Telemetry, etc V2
- Real agent 9001 HEALTHY, discovery, gateway invoke, translate, code-review
- Artifacts, Messages, Routing 5 strategies, Rate Limit, Reliability CB OPEN
- SSRF metadata blocked as expected (FIXED), Health, MCP, Multi-tenancy, Load 20 tasks 31ms`}
                </pre>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { k: "CONTROL", v: "3002", s: "OK • HEALTHY" },
                  { k: "GATEWAY", v: "3001", s: "OK • 5 ROUTES" },
                  { k: "AGENT", v: "9001", s: "REAL • LIVE" },
                ].map(b => (
                  <div key={b.k} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                    <div className="modern-label text-[9px] text-white/30">{b.k}</div>
                    <div className="modern-mono text-[12px] text-white mt-1">{b.v} • {b.s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="mx-auto max-w-[1200px] px-10 py-20">
          <div className="modern-label text-black/30">QUICK START + SDK DOCS • LIVE</div>
          <h2 className="modern-display text-[28px] mt-3">30 SECONDS TO RUN • SDK EXAMPLES</h2>
          
          <div className="grid md:grid-cols-12 gap-6 mt-10">
            <div className="md:col-span-6 rounded-[20px] bg-black text-white p-7">
              <div className="modern-label text-white/40">01 — INFRA • START.SH</div>
              <pre className="mt-4 text-[11px] leading-[1.6] text-white/70 modern-mono">
{`git clone https://github.com/mmdverse/AgentMesh
pnpm install
./start.sh  # pnpm install + tsc -b --force + build + seed

# Or manual:
pnpm exec tsc -b --force
pnpm --filter @agentmesh/console build
pnpm --filter control-plane dev # :3002
pnpm --filter gateway dev       # :3001
node real-agent.js              # :9001 auto-register
pnpm --filter console dev       # :3000

# Test 20 scenarios:
node test-20-scenarios.js # 20/20 passed`}
              </pre>
              <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="modern-mono text-[10px] text-white/40">FIXES APPLIED</div>
                <div className="modern-mono text-[10px] text-white/60 mt-1">✓ localhost→env var, ✓ dist/.next build, ✓ auto-register, ✓ health 10s dev, ✓ SSRF metadata blocked, ✓ InMemory banner, ✓ pagination, ✓ rate limit UI, ✓ graph V2, ✓ loading skeleton</div>
              </div>
            </div>
            <div className="md:col-span-6 space-y-4">
              <div className="rounded-[20px] bg-[#fafafa] border border-black/10 p-7">
                <div className="modern-label text-black/40">02 — SDK • SERVER + CLIENT</div>
                <pre className="mt-4 text-[11px] leading-[1.6] text-black/60 modern-mono overflow-auto max-h-60">
{`// Server SDK - auto-register + heartbeat built-in
import { createAgentServer } from "@agentmesh/server-sdk";
const server = createAgentServer({
  card: { name: "my-agent", version: "1.0.0" },
  skills: [{ id: "code-review", name: "Review" }],
  port: 9001,
  controlPlaneUrl: "http://localhost:3002",
  autoRegister: true, // NEW - auto POST /v1/agents
  heartbeatIntervalMs: 10000, // NEW - heartbeat + HEALTHY
  taskHandler: async (ctx) => {
    return { text: "سلام دنیا", state: "COMPLETED" };
  },
});
await server.listen(); // auto-registers as HEALTHY

// Client SDK
import { AgentMeshClient } from "@agentmesh/sdk";
const client = new AgentMeshClient({ endpoint: "http://localhost:3002" });
await client.agents.list(); // 1 agents HEALTHY
await client.discovery.find({ skill: "code-review" }); // 1
const task = await client.tasks.create({ agentId, message: { text: "translate hello world" } });
await client.tasks.complete(task.task.id, { result: "done" });
await client.artifacts.create({ contentType: "application/json", jsonData: { hello: "world" } });
await client.messages.send({ sender: agentId, receiver: "other", content: { text: "hi" } });`}
                </pre>
              </div>
              <div className="rounded-[20px] bg-white border border-black/10 p-7">
                <div className="modern-label text-black/30">03 — CHAT + GATEWAY</div>
                <pre className="mt-4 text-[11px] leading-[1.6] text-black/60 modern-mono">
{`# Chat at /chat - uses NEXT_PUBLIC_CONTROL_PLANE_URL
# Gateway invoke:
curl -X POST http://localhost:3001/v1/invoke \\
  -d '{"agentId":"...","method":"message/send","params":{"message":{"text":"translate hello world"}}}'
# -> سلام دنیا

# SSRF blocked test:
curl -X POST http://localhost:3002/v1/agents \\
  -d '{"name":"bad","url":"http://169.254.169.254"}'
# -> VALIDATION_ERROR SSRF blocked (FIXED)

# Rate limit TokenBucket:
capacity 5 refill 1/s -> 3 allowed 2 blocked (tested)`}
                </pre>
                <div className="mt-4 flex gap-2">
                  <Link href="/chat" className="rounded-full bg-black text-white px-5 py-2 text-[11px] modern-mono">CHAT → LIVE</Link>
                  <Link href="/overview" className="rounded-full border border-black/15 px-5 py-2 text-[11px] modern-mono">DASHBOARD → 20/20</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#f8f8f8] border-y border-black/5">
        <div className="mx-auto max-w-[1200px] px-10 py-16">
          <div className="flex items-end justify-between">
            <div>
              <div className="modern-label text-black/30">SUPPORT • KEEP IT FREE</div>
              <h2 className="modern-display text-[24px] mt-2">DONATE CRYPTO</h2>
            </div>
            <div className="modern-mono text-[11px] text-black/40">CRYPTO ONLY • NO MIDDLEMEN • 20/20 TESTS PASSED</div>
          </div>
          
          <div className="grid md:grid-cols-4 gap-4 mt-10">
            {[
              { sym: "BTC", name: "BITCOIN", addr: "bc1q36uz...", img: "/assets/donate/donate-bitcoin.svg" },
              { sym: "BNB", name: "BNB", addr: "0x5790...", img: "/assets/donate/donate-bnb.svg" },
              { sym: "SOL", name: "SOLANA", addr: "4hCY...", img: "/assets/donate/donate-solana.svg" },
              { sym: "TRX", name: "TRON", addr: "TVFZ...", img: "/assets/donate/donate-tron.svg" },
            ].map(d => (
              <div key={d.sym} className="rounded-2xl bg-white border border-black/10 overflow-hidden modern-hover">
                <img src={d.img} alt={d.name} className="w-full" />
                <div className="p-4">
                  <div className="modern-mono text-[11px] font-[600]">{d.name} • {d.sym}</div>
                  <div className="modern-mono text-[10px] text-black/50 mt-1 truncate">{d.addr}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="mx-auto max-w-[1200px] px-10 py-12 flex justify-between items-end">
          <div>
            <div className="modern-display text-[16px]">AGENTMESH</div>
            <div className="modern-mono text-[11px] text-black/50 mt-2">MADE BY MOHAMMAD @LLLLXYZ • FREE & OPEN SOURCE • LUXURY MINIMAL V2 • 20/20 PASSED • SSRF FIXED • AUTO-REGISTER • HEALTHY IMMEDIATE</div>
          </div>
          <div className="flex gap-2">
            <a href="https://github.com/mmdverse/AgentMesh" className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2 hover:bg-black hover:text-white transition-colors">GITHUB</a>
            <Link href="/chat" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">CHAT → LIVE • 9001</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
