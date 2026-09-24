import { api } from "@/lib/api";

export default async function SecurityPage() {
  let webhooks: any = { webhooks: [] }, deliveries: any = { deliveries: [] };
  try { webhooks = await api.controlPlane.webhooks.list(); } catch {}
  try { deliveries = await api.controlPlane.webhooks.deliveries(); } catch {}

  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">SECURITY • THREAT MODEL • WEBHOOKS • 13</div><h1 className="modern-display text-[32px] mt-2">SECURITY</h1><div className="modern-mono text-[11px] text-black/50 mt-2">TRUST LEVELS • POLICY DENIALS • AUTH EVENTS • WEBHOOK DELIVERIES • {webhooks.webhooks?.length||0} WEBHOOKS</div></div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">THREAT MODEL COVERAGE</div>
          <div className="mt-4 space-y-2 modern-mono text-[11px] leading-[1.5]">
            <div>• Malicious agent — Trust UNTRUSTED/EXTERNAL/VERIFIED/ORG/SYSTEM</div>
            <div>• Compromised — Circuit breaker OPEN, health UNHEALTHY</div>
            <div>• Malicious Card — Schema validation, signature verification</div>
            <div>• Prompt injection — Input sanitization, policy check</div>
            <div>• Data exfiltration — Artifact access control, audit logs</div>
            <div>• DoS — Rate limiting 1000/s global, bulkhead isolation</div>
          </div>
        </div>
        <div className="md:col-span-6 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">WEBHOOKS • {webhooks.webhooks?.length||0}</div>
          <div className="mt-4 space-y-2 max-h-[200px] overflow-auto">
            {webhooks.webhooks?.map((w:any)=><div key={w.id} className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 modern-mono text-[10px]">{w.url} • {w.events?.join(",")||"all"}</div>)}
            {(!webhooks.webhooks || webhooks.webhooks.length===0) && <div className="modern-mono text-[11px] text-white/30 text-center p-4">NO WEBHOOKS</div>}
          </div>
          <div className="mt-6 modern-label text-white/40">DELIVERIES • {deliveries.deliveries?.length||0}</div>
          <div className="mt-3 space-y-1 max-h-[120px] overflow-auto">
            {deliveries.deliveries?.slice(-10).map((d:any,i:number)=><div key={i} className="modern-mono text-[10px] text-white/50">{d.status} • {d.webhookId?.slice(0,8)} • {d.attempt||1} tries</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
