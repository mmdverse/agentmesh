export default function PoliciesPage() {
  const policies = [
    { id:"allow_all_dev", name:"Allow All (Dev)", effect:"allow", subjects:["*"], resources:["*"], actions:["*"], priority:-100 },
    { id:"deny_untrusted_prod", name:"Deny Untrusted Prod Deploy", effect:"deny", resources:["env:production","skill:prod.deploy"], conditions:{ trustLevel:["UNTRUSTED","EXTERNAL"] }, priority:100 },
    { id:"allow_org", name:"Allow Organization Agents", effect:"allow", subjects:["agent:*"], resources:["agent:*","skill:*","task:*"], actions:["agent:read","skill:invoke","task:create"], priority:50 },
  ];
  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">POLICY ENGINE • ALLOW DENY • PRIORITY • 15</div><h1 className="modern-display text-[32px] mt-2">POLICIES</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{policies.length} POLICIES • EVALUATION ORDER BY PRIORITY • FIRST DENY WINS</div></div>
      <div className="grid md:grid-cols-12 gap-4">
        {policies.map(p=>(
          <div key={p.id} className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between"><span className="text-[11px] font-[700]">{p.name.toUpperCase()}</span><span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${p.effect==="allow"?"bg-black text-white":"bg-black/10 text-black"}`}>{p.effect.toUpperCase()}</span></div>
            <div className="mt-4 space-y-2 modern-mono text-[10px]">
              <div><span className="text-black/30">ID</span> {p.id}</div>
              <div><span className="text-black/30">PRIORITY</span> {p.priority}</div>
              <div><span className="text-black/30">RESOURCES</span> {p.resources?.join(", ").slice(0,60)}</div>
              {p.conditions && <div className="rounded-xl bg-[#fafafa] border border-black/5 p-2 mt-2">{JSON.stringify(p.conditions)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
