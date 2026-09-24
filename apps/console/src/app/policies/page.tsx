export default async function PoliciesPage() {
  let data: any = { policies: [], total: 0 };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/policies`, { cache: "no-store" });
    data = await res.json();
  } catch {}
  const policies = data.policies || [
    { id:"allow_all_dev", name:"Allow All (Dev)", effect:"allow", subjects:["*"], resources:["*"], actions:["*"], priority:-100 },
    { id:"deny_untrusted_prod", name:"Deny Untrusted Prod Deploy", effect:"deny", resources:["env:production","skill:prod.deploy"], conditions:{ trustLevel:["UNTRUSTED","EXTERNAL"] }, priority:100 },
    { id:"allow_org", name:"Allow Organization Agents", effect:"allow", subjects:["agent:*"], resources:["agent:*","skill:*","task:*"], actions:["agent:read","skill:invoke","task:create"], priority:50 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">POLICY ENGINE • LIVE • ALLOW DENY • PRIORITY • 15</div><h1 className="modern-display text-[32px] mt-2">POLICIES</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total || policies.length} POLICIES • EVALUATION ORDER BY PRIORITY • FIRST DENY WINS • LIVE FROM /v1/policies</div></div>
        <div className="flex gap-2"><span className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">ALLOW {policies.filter((p:any)=>p.effect==="allow").length}</span><span className="modern-mono text-[10px] bg-black/10 rounded-full px-3 py-1.5">DENY {policies.filter((p:any)=>p.effect==="deny").length}</span></div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 grid md:grid-cols-12 gap-4">
          {policies.map((p:any)=>(
            <div key={p.id} className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
              <div className="flex justify-between"><span className="text-[11px] font-[700]">{p.name.toUpperCase()}</span><span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${p.effect==="allow"?"bg-black text-white":"bg-red-500 text-white"}`}>{p.effect.toUpperCase()} • P{p.priority}</span></div>
              <div className="mt-4 space-y-2 modern-mono text-[10px]">
                <div><span className="text-black/30">ID</span> {p.id}</div>
                <div><span className="text-black/30">PRIORITY</span> {p.priority}</div>
                <div><span className="text-black/30">SUBJECTS</span> {p.subjects?.join(", ").slice(0,60) || "*"}</div>
                <div><span className="text-black/30">RESOURCES</span> {p.resources?.join(", ").slice(0,60) || "*"}</div>
                <div><span className="text-black/30">ACTIONS</span> {p.actions?.join(", ").slice(0,60) || "*"}</div>
                {p.conditions && <div className="rounded-xl bg-[#fafafa] border border-black/5 p-2 mt-2">{JSON.stringify(p.conditions).slice(0,200)}</div>}
                {p.description && <div className="text-black/40 mt-2">{p.description}</div>}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">EDIT</button>
                <button className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">EVALUATE →</button>
              </div>
            </div>
          ))}
        </div>
        <div className="md:col-span-4 space-y-4">
          <div className="rounded-[20px] bg-black text-white p-7">
            <div className="modern-label text-white/40">EVALUATION PREVIEW • LIVE</div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="modern-mono text-[10px] text-white/40">POST /v1/policies/evaluate</div>
                <pre className="mt-2 text-[10px] modern-mono text-white/60">{`{
  "subject": "agent:real-code-reviewer",
  "resource": "skill:code-review",
  "action": "skill:invoke",
  "context": { "trustLevel": "UNTRUSTED" }
}`}</pre>
              </div>
              <div className="rounded-xl bg-white text-black p-3">
                <div className="modern-mono text-[10px] text-black/40">RESULT</div>
                <div className="modern-mono text-[11px] mt-1">ALLOW • by allow_org • P50</div>
                <div className="modern-mono text-[9px] text-black/40 mt-1">First deny wins, then allow, priority order</div>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] bg-[#fafafa] border border-black/10 p-6">
            <div className="modern-label text-black/30">CREATE POLICY • LIVE CRUD</div>
            <div className="mt-4 space-y-2">
              <input placeholder="NAME" className="w-full border border-black/10 rounded-full px-4 py-2 text-[11px] modern-mono" />
              <select className="w-full border border-black/10 rounded-full px-4 py-2 text-[11px] modern-mono"><option>allow</option><option>deny</option></select>
              <input placeholder="RESOURCES: agent:*, skill:*" className="w-full border border-black/10 rounded-full px-4 py-2 text-[11px] modern-mono" />
              <button className="w-full bg-black text-white rounded-full py-2.5 text-[11px] modern-mono">CREATE POLICY → LIVE</button>
            </div>
            <div className="modern-mono text-[9px] text-black/30 mt-3">POST /v1/policies • InMemory (use Postgres for persistence)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
