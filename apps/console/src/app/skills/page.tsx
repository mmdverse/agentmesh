import { api } from "@/lib/api";

export default async function SkillsPage() {
  let agents: any = { agents: [], total: 0 };
  let skillsData: any = { skills: [], total: 0 };
  try { agents = await api.controlPlane.agents.list({ limit: "100" }); } catch {}
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/skills`, { cache: "no-store" });
    skillsData = await res.json();
  } catch {}

  const skillMap = new Map<string, { count: number; agents: string[]; description?: string; invocations?: number }>();
  for (const agent of (agents.agents ?? []) as any[]) {
    for (const skill of (agent.skills ?? agent.tags ?? []) as any[]) {
      const skillId = typeof skill === "string" ? skill : skill.skillId || skill.id;
      const ex = skillMap.get(skillId) ?? { count:0, agents:[] as string[], description: typeof skill === "object" ? skill.description : undefined, invocations: 0 };
      ex.count++; ex.agents.push(agent.name); skillMap.set(skillId, ex);
    }
  }
  // Merge with live skills data
  for (const s of skillsData.skills || []) {
    const existing = skillMap.get(s.id);
    if (existing) {
      existing.description = s.description || existing.description;
      existing.invocations = s.invocations;
    } else {
      skillMap.set(s.id, { count: s.agents || 0, agents: [], description: s.description, invocations: s.invocations });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">CAPABILITIES • LIVE • DISCOVERY • 09 • {skillMap.size} TOTAL</div><h1 className="modern-display text-[32px] mt-2">SKILLS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{skillMap.size} UNIQUE SKILLS • {agents.total} AGENTS • DISCOVERY BY SKILL TAG • LIVE FROM /v1/skills + registry</div></div>
        <div className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">{skillMap.size} SKILLS • LIVE</div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        {Array.from(skillMap.entries()).map(([id, info])=>(
          <div key={id} className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between"><span className="text-[12px] font-[700] tracking-[-0.01em]">{id.toUpperCase()}</span><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{info.count} AGENTS • {info.invocations || 0} INVOC</span></div>
            <div className="modern-mono text-[11px] text-black/50 mt-3 leading-[1.4]">{info.description||"No description — from agent card"}</div>
            <div className="mt-4 flex flex-wrap gap-1">{info.agents.slice(0,4).map((a:string)=><span key={a} className="modern-mono text-[9px] bg-[#f5f5f5] border border-black/5 px-2 py-1 rounded-full">{a.toUpperCase()}</span>)}</div>
            <div className="mt-4 flex gap-2">
              <span className="modern-mono text-[9px] border border-black/10 px-2 py-1 rounded-full">DISCOVERY: /v1/agents/discover?skill={id}</span>
            </div>
          </div>
        ))}
      </div>
      {skillMap.size===0 && <div className="rounded-[20px] border border-black/10 p-12 text-center modern-mono text-[11px] text-black/30">NO SKILLS DISCOVERED • REGISTER AGENT WITH SKILLS • real-agent has code-review + translate</div>}

      <div className="rounded-[20px] bg-black text-white p-6">
        <div className="modern-label text-white/40">LIVE SKILLS JSON • /v1/skills</div>
        <pre className="mt-3 bg-white/5 border border-white/10 rounded-xl p-4 text-[10px] modern-mono text-white/60 max-h-60 overflow-auto">{JSON.stringify(skillsData, null, 2).slice(0,2000)}</pre>
      </div>
    </div>
  );
}
