import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black -m-10">
      {/* Hero — Modern Luxury V2 */}
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
                <span className="modern-label text-black/50">OPEN SOURCE • FREE • PRODUCTION-GRADE • 1.0.0</span>
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
                  A2A first-class, MCP bridged, Service Mesh for Agentic Workloads. Every agentic system rebuilds the same infra. We provide it once — <span className="text-black font-[600]">production-grade, free, no vendor lock-in.</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/overview" className="group inline-flex items-center gap-3 rounded-full bg-black text-white px-8 py-4 text-[13px] font-[600] tracking-[-0.01em] modern-hover">
                OPEN CONSOLE
                <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-[10px] group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
              <Link href="/chat" className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-8 py-4 text-[13px] font-[500] hover:bg-black hover:text-white hover:border-black transition-colors">
                TRY CHAT UI
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
              <span className="modern-mono text-[10px] text-black/40">7 LANGUAGES • FREE • NO LICENSE</span>
            </div>
          </div>

          <div className="absolute top-20 right-10 hidden lg:block">
            <div className="relative">
              <div className="w-[320px] rounded-[24px] overflow-hidden border border-black/10 modern-shadow-lg bg-white">
                <img src="/assets/agentmesh-banner.svg" alt="AgentMesh" className="w-full" />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: "AGENTS", value: "1 LIVE" },
                  { label: "TASKS", value: "22 COMPLETED" },
                  { label: "REAL AGENT", value: "9001 • TRANSLATE" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-2 border-b border-black/5 last:border-0">
                    <span className="modern-label text-[10px] text-black/40">{s.label}</span>
                    <span className="modern-mono text-[11px] font-[500]">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features — Bento Grid Modern */}
      <div className="bg-[#fafafa] border-b border-black/5">
        <div className="mx-auto max-w-[1200px] px-10 py-20">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="modern-label text-black/30">FEATURES — PHASES 0-5 COMPLETE</div>
              <h2 className="modern-display text-[36px] mt-3 tracking-[-0.04em]">WHY AGENTMESH</h2>
            </div>
            <div className="hidden md:block text-right">
              <div className="modern-mono text-[11px] text-black/40">9 CORE PRIMITIVES</div>
              <div className="modern-mono text-[11px] text-black/60">PRODUCTION-GRADE</div>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-4">
            {[
              { title: "DISCOVERY", desc: "Find agents by skill, capability, version, region, health.", span: "col-span-12 md:col-span-4", label: "01" },
              { title: "ROUTING", desc: "5 strategies: round_robin, least_loaded, latency_aware, weighted, capability_match.", span: "col-span-12 md:col-span-4", label: "02" },
              { title: "RELIABILITY", desc: "Circuit Breaker, Bulkhead, Retry with jitter, Timeout, Idempotency.", span: "col-span-12 md:col-span-4", label: "03" },
              { title: "SECURITY", desc: "ApiKey, JWT, OIDC, mTLS, Workload Identity. RBAC/ABAC, tenant isolation, SSRF protection.", span: "col-span-12 md:col-span-6", label: "04" },
              { title: "TASKS & MESSAGING", desc: "Lifecycle SUBMITTED→WORKING→COMPLETED/FAILED, delegation tree, live graph, SSE streaming, sync/async.", span: "col-span-12 md:col-span-6", label: "05" },
              { title: "ARTIFACTS", desc: "S3 lifecycle, checksum, presigned URLs.", span: "col-span-12 md:col-span-3", label: "06" },
              { title: "MCP BRIDGE", desc: "A2A ↔ MCP translation.", span: "col-span-12 md:col-span-3", label: "07" },
              { title: "OBSERVABILITY", desc: "OTel tracing User→Agent→Tool, metrics, spans.", span: "col-span-12 md:col-span-6", label: "08" },
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

      {/* Architecture — Minimal Black */}
      <div className="bg-black text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="relative mx-auto max-w-[1200px] px-10 py-20">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-5">
              <div className="modern-label text-white/30">ARCHITECTURE</div>
              <h2 className="modern-display text-[32px] mt-4 leading-[0.9]">CONTROL /<br/>DATA PLANE</h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] p-5">
                  <div className="modern-label text-white/40 text-[10px]">DATA PLANE — 3001</div>
                  <div className="text-[13px] mt-2 leading-[1.5] text-white/80">Gateway Cluster, 10k+ RPS, stateless, 5 routing strategies, Circuit Breaker, Bulkhead, A2A Proxy</div>
                </div>
                <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] p-5">
                  <div className="modern-label text-white/40 text-[10px]">CONTROL PLANE — 3002</div>
                  <div className="text-[13px] mt-2 leading-[1.5] text-white/80">Registry, Tasks, Policies, Postgres + Redis + NATS + S3, OTel tracing</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="rounded-[20px] bg-[#0a0a0a] border border-white/[0.08] p-6">
                <pre className="text-[11px] leading-[1.7] text-white/60 modern-mono overflow-auto">
{`User -> Gateway (3001) [round_robin, least_loaded, latency_aware, weighted, capability_match]
  -> Circuit Breaker (CLOSED/OPEN/HALF_OPEN)
  -> Bulkhead (max 10 concurrent)
  -> Rate Limiter (TokenBucket 5/sec)
  -> A2A Proxy (SSRF protection)
  -> Real Agent (9001) real-code-reviewer
     [code-review, translate]
     -> "سلام دنیا"

Control Plane (3002):
  Registry (1 agents) • Tasks (22) • Artifacts (11) • Messages (16)
  Observability: 115 spans • 115 metrics

Chat: /chat -> agent 9001 -> task -> direct A2A -> response`}
                </pre>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { k: "CONTROL", v: "3002", s: "OK" },
                  { k: "GATEWAY", v: "3001", s: "OK" },
                  { k: "AGENT", v: "9001", s: "REAL" },
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

      {/* Quick Start — White */}
      <div className="bg-white">
        <div className="mx-auto max-w-[1200px] px-10 py-20">
          <div className="modern-label text-black/30">QUICK START</div>
          <h2 className="modern-display text-[28px] mt-3">30 SECONDS TO RUN</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mt-10">
            <div className="rounded-[20px] bg-black text-white p-7">
              <div className="modern-label text-white/40">01 — INFRA</div>
              <pre className="mt-4 text-[11px] leading-[1.6] text-white/70 modern-mono">
{`git clone https://github.com/mmdverse/AgentMesh
pnpm install
pnpm turbo run build --force
docker compose -f infra/docker-compose.yml up -d
pnpm --filter control-plane dev
pnpm --filter gateway dev
pnpm --filter console dev`}
              </pre>
            </div>
            <div className="rounded-[20px] bg-[#fafafa] border border-black/10 p-7">
              <div className="modern-label text-black/40">02 — CHAT</div>
              <pre className="mt-4 text-[11px] leading-[1.6] text-black/60 modern-mono">
{`# Register agent
curl -X POST http://localhost:3002/v1/agents \\
  -d '{"name":"my-agent","url":"http://localhost:9001"}'

# Chat at /chat
# Try: translate hello world
# -> سلام دنیا`}
              </pre>
              <div className="mt-6 flex gap-2">
                <Link href="/chat" className="rounded-full bg-black text-white px-5 py-2 text-[11px] modern-mono">CHAT →</Link>
                <Link href="/overview" className="rounded-full border border-black/15 px-5 py-2 text-[11px] modern-mono">DASHBOARD →</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Donate — Modern */}
      <div className="bg-[#f8f8f8] border-y border-black/5">
        <div className="mx-auto max-w-[1200px] px-10 py-16">
          <div className="flex items-end justify-between">
            <div>
              <div className="modern-label text-black/30">SUPPORT</div>
              <h2 className="modern-display text-[24px] mt-2">KEEP IT FREE</h2>
            </div>
            <div className="modern-mono text-[11px] text-black/40">CRYPTO ONLY • NO MIDDLEMEN</div>
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

      {/* Footer */}
      <div className="bg-white">
        <div className="mx-auto max-w-[1200px] px-10 py-12 flex justify-between items-end">
          <div>
            <div className="modern-display text-[16px]">AGENTMESH</div>
            <div className="modern-mono text-[11px] text-black/50 mt-2">MADE BY MOHAMMAD @LLLLXYZ • FREE & OPEN SOURCE • LUXURY MINIMAL V2</div>
          </div>
          <div className="flex gap-2">
            <a href="https://github.com/mmdverse/AgentMesh" className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2 hover:bg-black hover:text-white transition-colors">GITHUB</a>
            <Link href="/chat" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">CHAT →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
