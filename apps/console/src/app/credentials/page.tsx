import { api } from "@/lib/api";

export default async function CredentialsPage() {
  let creds: any = { credentials: [], total: 0 };
  let secStats: any = {};
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/credentials`, { cache: "no-store" });
    creds = await res.json();
  } catch {}
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/security/stats`, { cache: "no-store" });
    secStats = await res.json();
  } catch {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">AUTH • LIVE • API KEYS JWT OIDC MTLS • 14</div><h1 className="modern-display text-[32px] mt-2">CREDENTIALS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{creds.total} CREDENTIALS • SECURITY • PLUGGABLE AUTH PROVIDERS • WORKLOAD IDENTITY • LIVE FROM /v1/credentials</div></div>
        <div className="flex gap-2"><span className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">API KEYS {secStats.auth?.apiKeys || creds.total}</span><span className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">JWT {secStats.auth?.jwt || 1}</span></div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">API KEYS • LIVE • {creds.total} TOTAL</div>
          <div className="mt-6 space-y-3">
            {creds.credentials?.map((c:any)=>(
              <div key={c.id} className="rounded-xl bg-[#fafafa] border border-black/5 p-4 flex justify-between">
                <div><div className="text-[12px] font-[600] flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-black" : "bg-black/20"}`} />{c.name.toUpperCase()}</div><div className="modern-mono text-[10px] text-black/40 mt-1">ID: {c.id} • TYPE: {c.type} • SCOPES: {c.scopes?.join(",") || c.type}</div><div className="modern-mono text-[10px] bg-black text-white rounded-full px-2 py-1 inline-block mt-2">{c.key}</div></div>
                <div className="text-right"><span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${c.isActive ? "bg-black text-white" : "bg-black/10"}`}>{c.isActive ? "ACTIVE" : "INACTIVE"}</span><div className="modern-mono text-[9px] text-black/30 mt-2">{new Date(c.createdAt).toLocaleDateString()}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-3 rounded-xl bg-black text-white">
            <div className="modern-label text-white/40">USAGE</div>
            <div className="modern-mono text-[10px] text-white/60 mt-2">Header: X-API-Key or Authorization: Bearer ApiKey_xxx</div>
            <pre className="mt-2 bg-white/10 rounded-lg p-2 text-[10px]">curl -H "X-API-Key: dev-api-key-12345" {process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/agents</pre>
          </div>
        </div>
        <div className="md:col-span-4 space-y-4">
          <div className="rounded-[20px] bg-black text-white p-7">
            <div className="modern-label text-white/40">JWT • ACTIVE • LIVE</div>
            <div className="mt-3 modern-mono text-[11px] text-white/50">HS256 • dev_jwt_secret_change_in_production • 1h expiry • OIDC ready</div>
            <pre className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] modern-mono text-white/60">Authorization: Bearer eyJhbG...{"{"}"role":"admin"{"}"}</pre>
            <div className="mt-4 flex gap-1">
              <span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">HS256</span>
              <span className="modern-mono text-[9px] bg-white text-black px-2 py-1 rounded-full">ACTIVE</span>
              <span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">1H EXPIRY</span>
            </div>
          </div>
          <div className="rounded-[20px] bg-[#fafafa] border border-black/10 p-6">
            <div className="modern-label text-black/30">AUTH PROVIDERS • LIVE</div>
            <div className="mt-4 space-y-2">
              {[
                { name: "API KEY", status: "ACTIVE", count: secStats.auth?.apiKeys || creds.total, desc: "X-API-Key header" },
                { name: "JWT", status: "ACTIVE", count: secStats.auth?.jwt || 1, desc: "HS256 dev secret" },
                { name: "OIDC", status: "READY", count: secStats.auth?.oidc || 0, desc: "Enterprise SSO" },
                { name: "MTLS", status: "READY", count: secStats.auth?.mtls || 0, desc: "Client cert" },
                { name: "WORKLOAD", status: "READY", count: 0, desc: "SPIFFE compatible" },
              ].map(p=>(
                <div key={p.name} className="flex justify-between items-center p-2 rounded-xl bg-white border border-black/5">
                  <div><div className="modern-mono text-[11px] font-[500]">{p.name}</div><div className="modern-mono text-[9px] text-black/40">{p.desc}</div></div>
                  <div className="text-right"><span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${p.status==="ACTIVE" ? "bg-black text-white" : "bg-black/5"}`}>{p.status}</span><div className="modern-mono text-[10px] mt-1">{p.count}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
