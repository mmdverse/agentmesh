export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">PROJECTS • VERSIONING PER PROJECT • 17</div><h1 className="modern-display text-[32px] mt-2">PROJECTS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">ORG → PROJECTS • TENANT ISOLATION • CANARY DEPLOYMENTS</div></div>
      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-7 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">MODEL</div>
          <pre className="mt-4 bg-[#fafafa] border border-black/5 rounded-xl p-4 text-[11px] modern-mono leading-[1.6]">{`Organization (org_123) name: Acme Corp slug: acme

Project A (proj_a)
  organizationId: org_123 slug: project-a
  Agents: CodeAgent v1.0.0, v2.0.0, v2.1.0-canary
  Tasks: task_abc
  Routing: weighted 90% v2, 10% canary

Project B (proj_b)
  Agents: DataAgent
  Routing: round_robin`}</pre>
        </div>
        <div className="md:col-span-5 rounded-[20px] bg-[#fafafa] border border-black/10 p-7">
          <div className="modern-label text-black/30">VERSIONING</div>
          <div className="mt-4 space-y-2">
            <div className="rounded-xl bg-white border border-black/5 p-4 flex justify-between"><span className="modern-mono text-[11px]">v1.0.0</span><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">STABLE</span></div>
            <div className="rounded-xl bg-white border border-black/5 p-4 flex justify-between"><span className="modern-mono text-[11px]">v2.0.0</span><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">STABLE 90%</span></div>
            <div className="rounded-xl bg-white border border-black/5 p-4 flex justify-between"><span className="modern-mono text-[11px]">v2.1.0-canary</span><span className="modern-mono text-[9px] border border-black/10 px-2 py-1 rounded-full">CANARY 10%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
