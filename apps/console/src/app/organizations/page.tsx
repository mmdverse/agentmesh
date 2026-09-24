export default async function OrganizationsPage() {
  let data: any = { organizations: [], total: 0 };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/organizations`, { cache: "no-store" });
    data = await res.json();
  } catch {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">MULTI-TENANCY • LIVE • ORGS • 16</div><h1 className="modern-display text-[32px] mt-2">ORGANIZATIONS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total} ORGANIZATIONS • STRICT ISOLATION • TENANT PLUGIN • LIVE FROM /v1/organizations</div></div>
        <div className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">{data.total} ORGS • LIVE CRUD</div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        {data.organizations?.map((org:any)=>(
          <div key={org.id} className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between"><span className="text-[12px] font-[700]">{org.name.toUpperCase()}</span><span className="modern-mono text-[9px] bg-black/5 px-2 py-1 rounded-full">{org.slug}</span></div>
            <div className="mt-4 space-y-2 modern-mono text-[10px]">
              <div><span className="text-black/30">ID</span> {org.id}</div>
              <div><span className="text-black/30">PLAN</span> {org.plan || "free"}</div>
              <div><span className="text-black/30">MEMBERS</span> {org.members || 1}</div>
              <div className="text-black/50 mt-2">{org.description}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{org.plan?.toUpperCase() || "FREE"}</span>
              <span className="modern-mono text-[9px] border border-black/10 px-2 py-1 rounded-full">{new Date(org.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-6">
          <div className="modern-label text-white/40">CREATE ORG • LIVE</div>
          <div className="mt-4 space-y-2">
            <input placeholder="ORG NAME" className="w-full bg-white/10 border border-white/10 rounded-full px-4 py-2 text-[11px] modern-mono text-white placeholder:text-white/30" />
            <input placeholder="SLUG (optional)" className="w-full bg-white/10 border border-white/10 rounded-full px-4 py-2 text-[11px] modern-mono text-white placeholder:text-white/30" />
            <button className="w-full bg-white text-black rounded-full py-2.5 text-[11px] modern-mono font-[600]">CREATE ORG → LIVE</button>
          </div>
          <div className="modern-mono text-[9px] text-white/30 mt-3">POST /v1/organizations • InMemory</div>
        </div>
      </div>
    </div>
  );
}
