import { api } from "@/lib/api";

export default async function TelemetryPage() {
  let spans: any = { spans: [], total: 0 }, metrics: any = { metrics: [], total: 0 };
  try { spans = await api.controlPlane.observability.spans(); } catch {}
  try { metrics = await api.controlPlane.observability.metrics(); } catch {}

  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">OBSERVABILITY • LIVE • 07</div><h1 className="modern-display text-[32px] mt-2">TELEMETRY</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{spans.total||spans.spans?.length||0} SPANS • {metrics.total||metrics.metrics?.length||0} METRICS • OTEL TRACE USER→A→B→TOOL</div></div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">RECENT SPANS • {spans.total||0}</div>
          <div className="mt-6 space-y-2 max-h-[500px] overflow-auto">
            {spans.spans?.slice(-30).reverse().map((s:any)=>(
              <div key={s.id} className="flex justify-between items-center rounded-xl bg-[#fafafa] border border-black/5 px-4 py-3">
                <div><div className="modern-mono text-[11px] font-[500]">{s.name?.toUpperCase()}</div><div className="modern-mono text-[9px] text-black/40 mt-1">{s.traceId?.slice(0,8)} • {s.id?.slice(0,8)}</div></div>
                <div className="text-right"><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{s.status||"OK"}</span><div className="modern-mono text-[10px] text-black/50 mt-1">{s.durationMs}MS</div></div>
              </div>
            ))}
            {(!spans.spans || spans.spans.length===0) && <div className="modern-mono text-[11px] text-black/30 p-4 text-center">NO SPANS YET</div>}
          </div>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">METRICS • {metrics.total||0}</div>
          <div className="mt-6 space-y-2 max-h-[500px] overflow-auto">
            {metrics.metrics?.slice(-20).reverse().map((m:any,i:number)=>(
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="modern-mono text-[11px]">{m.name||m.metric}</div>
                <div className="modern-mono text-[10px] text-white/40 mt-1">{m.value ?? JSON.stringify(m).slice(0,60)}</div>
              </div>
            ))}
            {(!metrics.metrics || metrics.metrics.length===0) && <div className="modern-mono text-[11px] text-white/30 p-4 text-center">NO METRICS YET</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
