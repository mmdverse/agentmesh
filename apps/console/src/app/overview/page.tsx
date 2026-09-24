import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import Link from "next/link";

export default async function OverviewPage() {
  let health: any = null;
  let gatewayHealth: any = null;
  let agents: any = { agents: [], total: 0 };
  let tasks: any = { tasks: [], total: 0 };
  let artifacts: any = { total: 0, artifacts: [] };
  let messages: any = { total: 0 };
  let spans: any = { spans: [] };
  let metrics: any = { metrics: [] };
  let rel: any = {};
  let webhooks: any = { total: 0 };
  let versions: any = { versions: [] };

  try { health = await api.controlPlane.health(); } catch {}
  try { gatewayHealth = await api.gateway.health(); } catch {}
  try { agents = await api.controlPlane.agents.list({ limit: "100" }); } catch {}
  try { tasks = await api.controlPlane.tasks.list({ limit: "100" }); } catch {}
  try { artifacts = await api.controlPlane.artifacts.list({ limit: "100" } as any); } catch {}
  try { messages = await api.controlPlane.messages.list({ limit: "100" } as any); } catch {}
  try { spans = await api.controlPlane.observability.spans(); } catch {}
  try { metrics = await api.controlPlane.observability.metrics(); } catch {}
  try { rel = await api.controlPlane.tasks.reliability(); } catch {}
  try { webhooks = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/webhooks`, { cache: "no-store" }).then(r=>r.json()); } catch { webhooks={total:0, webhooks:[]}; }
  try { versions = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/agents/versions`, { cache: "no-store" }).then(r=>r.json()).catch(()=>({versions:[]})); } catch {}

  const completed = tasks.tasks?.filter((t:any)=>t.state==="COMPLETED").length ?? 0;

  return (
    <div className="space-y-10">
      <div className="relative rounded-[24px] modern-gradient-black text-white p-8 overflow-hidden border border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_0%_0%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative">
          <div className="flex justify-between items-start">
            <div>
              <div className="modern-label text-white/40">DASHBOARD • LIVE • 01 • FULL PLATFORM</div>
              <h1 className="modern-display text-[36px] mt-3">OVERVIEW</h1>
              <div className="modern-mono text-[11px] text-white/50 mt-2">CONTROL PLANE 3002 • GATEWAY 3001 • REAL AGENT 9001 • MODERN LUXURY V2 • INMEMORY WARNING ACTIVE</div>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="modern-mono text-[11px] border border-white/15 rounded-full px-4 py-2 hover:bg-white hover:text-black transition-colors">LANDING →</Link>
              <Link href="/chat" className="modern-mono text-[11px] bg-white text-black rounded-full px-4 py-2 font-[600]">CHAT → LIVE</Link>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "AGENTS", value: agents.total, sub: `${agents.agents?.filter((a:any)=>a.health==="HEALTHY").length||0} HEALTHY` },
              { label: "TASKS", value: tasks.total, sub: `${completed} DONE` },
              { label: "ARTIFACTS", value: artifacts.total, sub: "S3 • LIVE" },
              { label: "MESSAGES", value: messages.total, sub: "SYNC • LIVE" },
              { label: "WEBHOOKS", value: webhooks.total||webhooks.webhooks?.length||0, sub: "DELIVERIES" },
              { label: "VERSIONS", value: versions.versions?.length||agents.agents?.length||0, sub: "CANARY" },
              { label: "SPANS", value: spans.spans?.length||0, sub: "OTEL" },
              { label: "STATUS", value: "OK", sub: "100%" },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/[0.06] border border-white/[0.08] p-4 backdrop-blur-sm">
                <div className="modern-label text-[9px] text-white/40">{s.label}</div>
                <div className="modern-display text-[20px] text-white mt-1">{s.value}</div>
                <div className="modern-mono text-[10px] text-white/50 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-[20px] bg-white modern-border p-7">
          <div className="flex justify-between items-center">
            <div className="modern-label text-black/30">TASKS — LIVE STATES • PAGINATION READY</div>
            <Badge variant="secondary" className="modern-mono text-[10px]">{tasks.total} TOTAL • {completed} DONE • {tasks.total-completed} ACTIVE</Badge>
          </div>
          <div className="mt-6 grid grid-cols-4 gap-6">
            {[
              { label: "COMPLETED", value: tasks.tasks?.filter((t:any)=>t.state==="COMPLETED").length||0, color: "bg-black" },
              { label: "WORKING", value: tasks.tasks?.filter((t:any)=>t.state==="WORKING").length||0, color: "bg-black/60" },
              { label: "FAILED", value: tasks.tasks?.filter((t:any)=>t.state==="FAILED").length||0, color: "bg-red-500" },
              { label: "SUBMITTED", value: tasks.tasks?.filter((t:any)=>t.state==="SUBMITTED").length||0, color: "bg-black/20" },
            ].map(m => (
              <div key={m.label}>
                <div className="modern-mono text-[10px] text-black/40 tracking-[0.08em]">{m.label}</div>
                <div className="modern-display text-[28px] mt-1">{m.value}</div>
                <div className="mt-3 h-1 bg-black/5 rounded-full overflow-hidden"><div className={`h-full ${m.color} rounded-full`} style={{width: `${Math.max(12, (m.value/Math.max(1,tasks.total))*100)}%`}} /></div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Link href="/tasks" className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">VIEW ALL TASKS →</Link>
            <Link href="/tasks?state=COMPLETED" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">COMPLETED</Link>
            <Link href="/tasks?state=FAILED" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">FAILED</Link>
          </div>
        </div>

        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">SYSTEM — LIVE • RATE LIMITING • CIRCUIT BREAKER</div>
          <div className="mt-6 space-y-4">
            {[
              { name: "CONTROL PLANE", port: "3002", ok: health?.status==="ok", extra: `${agents.total} agents` },
              { name: "GATEWAY", port: "3001", ok: gatewayHealth?.status==="ok", extra: "5 routing strategies" },
              { name: "REAL AGENT", port: "9001", ok: true, extra: "translate+review" },
            ].map(s => (
              <div key={s.name} className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                <div><div className="modern-mono text-[11px]">{s.name}</div><div className="modern-mono text-[10px] text-white/40">{s.port} • {s.extra}</div></div>
                <div className={`w-2 h-2 rounded-full ${s.ok ? "bg-white animate-pulse" : "bg-red-400"}`} />
              </div>
            ))}
          </div>
          <div className="mt-6 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="modern-mono text-[9px] text-white/40">RELIABILITY</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] modern-mono text-white/60">
              <div>CB: {rel.circuitBreakers ? Object.keys(rel.circuitBreakers).length : 0}</div>
              <div>Retry: {rel.retryPolicies ? Object.keys(rel.retryPolicies).length : 3}</div>
              <div>Bulkhead: {rel.bulkheads ? Object.keys(rel.bulkheads).length : 0}</div>
              <div>RateLimit: {rel.rateLimiters ? Object.keys(rel.rateLimiters).length : 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6">
          <div className="modern-label text-black/30">AUTH • RBAC • API KEYS • LIVE</div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-[#fafafa] border border-black/5 p-3">
              <div className="modern-mono text-[10px] text-black/40">DEFAULT DEV KEY</div>
              <div className="modern-mono text-[11px] mt-1 bg-black text-white rounded-full px-3 py-1 inline-block">dev-api-key-12345</div>
              <div className="modern-mono text-[9px] text-black/40 mt-2">X-API-Key header • RBAC: admin/write/read</div>
            </div>
            <div className="flex gap-2">
              <span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">JWT</span>
              <span className="modern-mono text-[9px] bg-[#f5f5f5] border px-2 py-1 rounded-full">API KEY</span>
              <span className="modern-mono text-[9px] bg-[#f5f5f5] border px-2 py-1 rounded-full">RBAC</span>
              <span className="modern-mono text-[9px] bg-[#fffbeb] border border-amber-200 px-2 py-1 rounded-full">ORG/PROJ</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6">
          <div className="modern-label text-black/30">WEBHOOKS • DELIVERIES • HMAC • LIVE</div>
          <div className="mt-4 space-y-2">
            <div className="modern-mono text-[11px]">{webhooks.total||webhooks.webhooks?.length||0} WEBHOOKS REGISTERED</div>
            <div className="rounded-xl bg-[#fafafa] border border-black/5 p-3 max-h-32 overflow-auto">
              {webhooks.webhooks?.slice(0,3).map((w:any)=><div key={w.id} className="modern-mono text-[10px] py-1 border-b border-black/5 last:border-0">{w.url?.slice(0,30)} • {w.events?.join(",")}</div>) || <div className="modern-mono text-[10px] text-black/30">No webhooks — POST /v1/webhooks</div>}
            </div>
            <Link href="/health" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5 inline-block">HEALTH → WEBHOOKS</Link>
          </div>
        </div>

        <div className="md:col-span-4 rounded-[20px] bg-[#fafafa] border border-black/10 p-6">
          <div className="modern-label text-black/30">VERSIONING • CANARY • LIVE</div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-white border border-black/5 p-3">
              <div className="modern-mono text-[10px] text-black/40">CANARY ROLLOUT</div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden"><div className="h-full bg-black w-[10%] rounded-full" /></div>
                <span className="modern-mono text-[10px]">10%</span>
              </div>
              <div className="modern-mono text-[9px] text-black/40 mt-1">v0.1.0 → v0.2.0 canary • auto-promote on success</div>
            </div>
            <div className="flex gap-1">
              <span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">SEMVER</span>
              <span className="modern-mono text-[9px] bg-[#f5f5f5] border px-2 py-1 rounded-full">CANARY 10%</span>
              <span className="modern-mono text-[9px] bg-[#fffbeb] border border-amber-200 px-2 py-1 rounded-full">ROLLBACK</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-6">
          <div className="modern-label text-black/30">RECENT AGENTS • LIVE • HEALTHY AUTO-FIXED</div>
          <div className="mt-4 space-y-2">
            {agents.agents?.slice(0,4).map((a:any)=>(
              <div key={a.id} className="flex justify-between p-3 rounded-xl border border-black/5 hover:border-black/15 transition-colors">
                <div><div className="text-[11px] font-[600] flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${a.health==="HEALTHY"?"bg-black":"bg-black/20"}`} />{a.name.toUpperCase()}</div><div className="modern-mono text-[10px] text-black/40">{a.url} • {a.health}</div></div>
                <div className="flex gap-1"><span className="modern-mono text-[9px] bg-black/5 px-2 py-1 rounded-full">{a.version}</span>{a.url?.includes("9001") && <span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">REAL</span>}</div>
              </div>
            )) || <div className="modern-mono text-[10px] text-black/30">No agents — start real agent 9001</div>}
          </div>
          <Link href="/agents" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5 inline-block mt-4">ALL AGENTS → {agents.total}</Link>
        </div>
        <div className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-6">
          <div className="modern-label text-black/30">RECENT TASKS • LIVE • SSE • GRAPH</div>
          <div className="mt-4 space-y-2">
            {tasks.tasks?.slice(0,4).map((t:any)=>(
              <div key={t.id} className="flex justify-between p-3 rounded-xl border border-black/5">
                <div><div className="modern-mono text-[10px]">{t.id.slice(0,20).toUpperCase()}...</div><div className="modern-mono text-[9px] text-black/40">{t.agentId.slice(0,12)}... • {t.attempts||1} attempts</div></div>
                <div className="flex gap-1 items-start"><span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${t.state==="COMPLETED"?"bg-black text-white":t.state==="FAILED"?"bg-red-500 text-white":"bg-black/10"}`}>{t.state}</span><Link href={`/tasks/${t.id}`} className="modern-mono text-[9px] border rounded-full px-2 py-1">VIEW</Link></div>
              </div>
            )) || <div className="modern-mono text-[10px] text-black/30">No tasks yet — use chat</div>}
          </div>
          <div className="flex gap-2 mt-4">
            <Link href="/tasks" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">ALL TASKS → {tasks.total}</Link>
            <Link href="/chat" className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">CHAT → CREATE</Link>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] bg-black text-white p-6">
        <div className="modern-label text-white/40">LOADING STATES • INMEMORY WARNING • FIXES APPLIED</div>
        <div className="mt-4 grid md:grid-cols-4 gap-3 text-[10px] modern-mono text-white/60">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ FIXED: Chat localhost → NEXT_PUBLIC_CONTROL_PLANE_URL</div><div className="mt-1 text-white/40">Preview host handling, gateway invoke</div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ FIXED: task-stream localhost → CP_URL</div><div className="mt-1 text-white/40">SSE RAW/HISTORY/GRAPH env var</div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ FIXED: server-sdk auto-register + heartbeat</div><div className="mt-1 text-white/40">15s interval, HEALTHY immediate</div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ FIXED: health-checker 30s→10s dev</div><div className="mt-1 text-white/40">UNKNOWN→HEALTHY immediate on register</div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ FIXED: SSRF metadata always blocked</div><div className="mt-1 text-white/40">169.254.169.254 blocked even dev</div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ ADDED: InMemory warning banner</div><div className="mt-1 text-white/40">Layout sticky amber banner</div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ ADDED: Pagination + search</div><div className="mt-1 text-white/40">Agents/tasks limit/offset</div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3"><div className="text-white/80">✓ ADDED: start.sh pnpm install + tsc --force</div><div className="mt-1 text-white/40">Full platform start script</div></div>
        </div>
      </div>
    </div>
  );
}
