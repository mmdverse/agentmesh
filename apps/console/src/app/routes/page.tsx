import { api } from "@/lib/api";

export default async function RoutesPage() {
  let gwInfo: any = {}, rel: any = {};
  try { gwInfo = await api.gateway.info(); } catch {}
  try { rel = await api.gateway.reliability(); } catch {}

  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">ROUTING • STRATEGIES • 10</div><h1 className="modern-display text-[32px] mt-2">ROUTES</h1><div className="modern-mono text-[11px] text-black/50 mt-2">ROUND_ROBIN • WEIGHTED • LEAST_LOADED • LATENCY_AWARE • CAPABILITY_MATCH</div></div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-7 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">GATEWAY INFO • :3001</div>
          <pre className="mt-4 bg-[#fafafa] border border-black/5 rounded-xl p-4 text-[10px] modern-mono overflow-auto max-h-[400px]">{JSON.stringify(gwInfo, null, 2).slice(0,3000)}</pre>
        </div>
        <div className="md:col-span-5 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">RELIABILITY • GATEWAY</div>
          <pre className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 text-[10px] modern-mono text-white/60 overflow-auto max-h-[400px]">{JSON.stringify(rel, null, 2).slice(0,3000)}</pre>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {["ROUND_ROBIN","WEIGHTED","LEAST_LOADED","LATENCY_AWARE"].map(s=><span key={s} className="modern-mono text-[9px] bg-white/10 border border-white/10 rounded-full px-2 py-1 text-center">{s}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
