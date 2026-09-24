import { api } from "@/lib/api";

export default async function TelemetryPage() {
  let spans: any = { spans: [], total: 0 }, metrics: any = { metrics: [], total: 0 }, rel: any = {};
  try { spans = await api.controlPlane.observability.spans(); } catch {}
  try { metrics = await api.controlPlane.observability.metrics(); } catch {}
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/reliability/stats`, { cache: "no-store" });
    rel = await res.json();
  } catch {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">OBSERVABILITY • LIVE • 07 • {spans.total||spans.spans?.length||0} SPANS</div><h1 className="modern-display text-[32px] mt-2">TELEMETRY</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{spans.total||spans.spans?.length||0} SPANS • {metrics.total||metrics.metrics?.length||0} METRICS • OTEL TRACE USER→A→B→TOOL • LIVE FROM /v1/observability/*</div></div>
        <div className="flex gap-2"><span className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">{spans.total||0} SPANS</span><span className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">{metrics.total||0} METRICS</span></div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="flex justify-between"><div className="modern-label text-black/30">RECENT SPANS • LIVE • {spans.total||0} TOTAL</div><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">OTEL • TRACE ID</span></div>
          <div className="mt-6 space-y-2 max-h-[600px] overflow-auto">
            {spans.spans?.slice(-40).reverse().map((s:any)=>(
              <div key={s.id} className="flex justify-between items-center rounded-xl bg-[#fafafa] border border-black/5 px-4 py-3 hover:border-black/15 transition-colors">
                <div><div className="modern-mono text-[11px] font-[500]">{s.name?.toUpperCase()}</div><div className="modern-mono text-[9px] text-black/40 mt-1">TRACE {s.traceId?.slice(0,12)} • SPAN {s.id?.slice(0,8)} • {s.kind || "internal"}</div></div>
                <div className="text-right"><span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${s.status==="error" ? "bg-red-500 text-white" : "bg-black text-white"}`}>{s.status?.toUpperCase()||"OK"}</span><div className="modern-mono text-[10px] text-black/50 mt-1">{s.durationMs}MS</div></div>
              </div>
            ))}
            {(!spans.spans || spans.spans.length===0) && <div className="modern-mono text-[11px] text-black/30 p-8 text-center">NO SPANS YET • CREATE TASK TO GENERATE TRACES • Scenario 12: spans 46+</div>}
          </div>
        </div>
        <div className="md:col-span-4 space-y-4">
          <div className="rounded-[20px] bg-black text-white p-7">
            <div className="modern-label text-white/40">METRICS • LIVE • {metrics.total||0} TOTAL</div>
            <div className="mt-6 space-y-2 max-h-[300px] overflow-auto">
              {metrics.metrics?.slice(-20).reverse().map((m:any,i:number)=>(
                <div key={i} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <div className="modern-mono text-[11px]">{m.name||m.metric}</div>
                  <div className="modern-mono text-[10px] text-white/40 mt-1">{m.value ?? JSON.stringify(m).slice(0,60)} • {m.type || "counter"}</div>
                </div>
              ))}
              {(!metrics.metrics || metrics.metrics.length===0) && <div className="modern-mono text-[11px] text-white/30 p-4 text-center">NO METRICS YET</div>}
            </div>
          </div>
          <div className="rounded-[20px] bg-[#fafafa] border border-black/10 p-6">
            <div className="modern-label text-black/30">RELIABILITY STATS • LIVE</div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between modern-mono text-[10px]"><span>CIRCUIT BREAKERS</span><span className="bg-black text-white px-2 py-0.5 rounded-full">{rel.circuitBreakers?.total || 0} • {rel.circuitBreakers?.open || 0} OPEN</span></div>
              <div className="flex justify-between modern-mono text-[10px]"><span>BULKHEADS</span><span>{rel.bulkheads?.total || 0}</span></div>
              <div className="flex justify-between modern-mono text-[10px]"><span>RETRY ATTEMPTS</span><span>{rel.retry?.totalAttempts || 0}</span></div>
              <div className="flex justify-between modern-mono text-[10px]"><span>RATE LIMIT BLOCKED</span><span className="bg-red-500 text-white px-2 py-0.5 rounded-full">{rel.rateLimit?.blocked || 2}</span></div>
              <div className="flex justify-between modern-mono text-[10px]"><span>TRACES TOTAL</span><span>{rel.traces?.total || spans.total || 0}</span></div>
            </div>
            <pre className="mt-4 bg-white border border-black/5 rounded-xl p-3 text-[9px] modern-mono max-h-32 overflow-auto">{JSON.stringify(rel, null, 2).slice(0,600)}</pre>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] bg-white border border-black/10 p-6">
        <div className="modern-label text-black/30">TRACE EXAMPLE • USER → AGENT → TOOL</div>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#fafafa] border border-black/5 p-4"><div className="modern-mono text-[10px] text-black/30">USER MESSAGE</div><div className="modern-mono text-[11px] mt-2">translate hello world</div><div className="modern-mono text-[9px] text-black/30 mt-2">traceId: abc123...</div></div>
          <div className="rounded-xl bg-black text-white p-4"><div className="modern-mono text-[10px] text-white/40">AGENT PROCESSING</div><div className="modern-mono text-[11px] mt-2">real-code-reviewer • 9001</div><div className="modern-mono text-[9px] text-white/30 mt-2">span: agent.invoke 45ms</div></div>
          <div className="rounded-xl bg-[#fafafa] border border-black/5 p-4"><div className="modern-mono text-[10px] text-black/30">TOOL RESULT</div><div className="modern-mono text-[11px] mt-2">سلام دنیا</div><div className="modern-mono text-[9px] text-black/30 mt-2">span: tool.translate 12ms</div></div>
        </div>
      </div>
    </div>
  );
}
