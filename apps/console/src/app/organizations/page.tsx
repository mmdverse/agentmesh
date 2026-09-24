export default function OrganizationsPage() {
  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">MULTI-TENANCY • ORG → PROJECT → AGENT • 16</div><h1 className="modern-display text-[32px] mt-2">ORGANIZATIONS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">TENANT ISOLATION • ORG MISMATCH 403 • CROSS-PROJECT POLICY</div></div>
      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-7 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">HIERARCHY</div>
          <pre className="mt-4 bg-[#fafafa] border border-black/5 rounded-xl p-4 text-[11px] modern-mono leading-[1.6]">{`Organization org_123
 +-- Project A proj_a
 |    +-- Agents: CodeAgent v1, v2, v2.1-canary
 |    +-- Tasks: task_abc, task_def
 |    +-- Policies: allow_org_agents
 |    +-- Credentials: api_key_123
 +-- Project B proj_b
      +-- Agents: DataAgent

Tenant Isolation:
- Org mismatch → 403
- Project mismatch → 403 (unless allowCrossProject)
- Versioning per project: v1, v2, canary`}</pre>
        </div>
        <div className="md:col-span-5 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">DEFAULT ORG</div>
          <div className="mt-6 space-y-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4"><div className="modern-mono text-[10px] text-white/40">ID</div><div className="modern-mono text-[12px] mt-1">org_default</div></div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4"><div className="modern-mono text-[10px] text-white/40">SLUG</div><div className="modern-mono text-[12px] mt-1">default</div></div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4"><div className="modern-mono text-[10px] text-white/40">NAME</div><div className="text-[13px] font-[600] mt-1">Default Organization</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
