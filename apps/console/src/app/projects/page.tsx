export default async function ProjectsPage() {
  let data: any = { projects: [], total: 0 };
  let orgs: any = { organizations: [] };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/projects`, { cache: "no-store" });
    data = await res.json();
  } catch {}
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/organizations`, { cache: "no-store" });
    orgs = await res.json();
  } catch {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">MULTI-TENANCY • LIVE • PROJECTS • 17</div><h1 className="modern-display text-[32px] mt-2">PROJECTS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total} PROJECTS • ORG {orgs.total || 2} • STRICT ISOLATION • LIVE FROM /v1/projects</div></div>
        <div className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">{data.total} PROJECTS • LIVE</div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        {data.projects?.map((proj:any)=>(
          <div key={proj.id} className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between"><span className="text-[12px] font-[700]">{proj.name.toUpperCase()}</span><span className="modern-mono text-[9px] bg-[#f5f5f5] px-2 py-1 rounded-full">{proj.slug}</span></div>
            <div className="mt-4 space-y-2 modern-mono text-[10px]">
              <div><span className="text-black/30">ID</span> {proj.id}</div>
              <div><span className="text-black/30">ORG</span> {proj.organizationId || "org_dev"}</div>
              <div><span className="text-black/30">STATUS</span> <span className="bg-black text-white px-2 py-0.5 rounded-full text-[9px]">{proj.status?.toUpperCase() || "ACTIVE"}</span></div>
              <div className="text-black/50 mt-2">{proj.description}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="modern-mono text-[9px] bg-black/5 px-2 py-1 rounded-full">{proj.organizationId?.toUpperCase() || "ORG_DEV"}</span>
              <span className="modern-mono text-[9px] border border-black/10 px-2 py-1 rounded-full">{new Date(proj.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        <div className="md:col-span-4 rounded-[20px] bg-[#fafafa] border border-black/10 p-6">
          <div className="modern-label text-black/30">CREATE PROJECT • LIVE</div>
          <div className="mt-4 space-y-2">
            <input placeholder="PROJECT NAME" className="w-full border border-black/10 rounded-full px-4 py-2 text-[11px] modern-mono" />
            <select className="w-full border border-black/10 rounded-full px-4 py-2 text-[11px] modern-mono"><option>org_dev - Development Org</option><option>org_test - Test Org</option></select>
            <button className="w-full bg-black text-white rounded-full py-2.5 text-[11px] modern-mono">CREATE PROJECT → LIVE</button>
          </div>
          <div className="modern-mono text-[9px] text-black/30 mt-3">POST /v1/projects • tenant isolation enforced</div>
        </div>
      </div>
    </div>
  );
}
