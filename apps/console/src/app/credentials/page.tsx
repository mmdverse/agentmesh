export default function CredentialsPage() {
  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">AUTH • API KEYS JWT OIDC MTLS • 14</div><h1 className="modern-display text-[32px] mt-2">CREDENTIALS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">SECURITY • PLUGGABLE AUTH PROVIDERS • WORKLOAD IDENTITY</div></div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">API KEYS • ACTIVE</div>
          <div className="mt-3 modern-mono text-[11px] text-black/50">Header: X-API-Key or Authorization: Bearer ApiKey_xxx</div>
          <pre className="mt-3 bg-[#fafafa] border border-black/5 rounded-xl p-3 text-[10px] modern-mono">curl -H "X-API-Key: your_key" http://localhost:3002/v1/agents</pre>
        </div>
        <div className="md:col-span-6 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">JWT • ACTIVE</div>
          <div className="mt-3 modern-mono text-[11px] text-white/50">HS256 • dev_jwt_secret_change_in_production • 1h expiry</div>
          <pre className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] modern-mono text-white/60">Authorization: Bearer eyJhbG...{"{"}"role":"admin"{"}"}</pre>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-[#fafafa] border border-black/10 p-6"><div className="modern-label text-black/30">OIDC</div><div className="modern-mono text-[11px] mt-3 text-black/50">Pluggable • Enterprise SSO ready</div></div>
        <div className="md:col-span-4 rounded-[20px] bg-[#fafafa] border border-black/10 p-6"><div className="modern-label text-black/30">MTLS</div><div className="modern-mono text-[11px] mt-3 text-black/50">Client cert verification • Workload identity</div></div>
        <div className="md:col-span-4 rounded-[20px] bg-[#fafafa] border border-black/10 p-6"><div className="modern-label text-black/30">WORKLOAD</div><div className="modern-mono text-[11px] mt-3 text-black/50">SPIFFE compatible • Attestation flow</div></div>
      </div>
    </div>
  );
}
