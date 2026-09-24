import { api } from "@/lib/api";

export default async function SkillsPage() {
  let agents: any = { agents: [] };
  try { agents = await api.controlPlane.agents.list({ limit: "100" }); } catch {}
  const skillMap = new Map<string, { count: number; agents: string[]; description?: string }>();
  for (const agent of (agents.agents ?? []) as any[]) {
    for (const skill of (agent.skills ?? []) as any[]) {
      const ex = skillMap.get(skill.skillId) ?? { count:0, agents:[] as string[], description: skill.description };
      ex.count++; ex.agents.push(agent.name); skillMap.set(skill.skillId, ex);
    }
  }

  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">CAPABILITIES • DISCOVERY • 09</div><h1 className="modern-display text-[32px] mt-2">SKILLS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{skillMap.size} UNIQUE SKILLS • {agents.agents?.length||0} AGENTS • DISCOVERY BY SKILL TAG</div></div>

      <div className="grid md:grid-cols-12 gap-4">
        {Array.from(skillMap.entries()).map(([id, info])=>(
          <div key={id} className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between"><span className="text-[12px] font-[700] tracking-[-0.01em]">{id.toUpperCase()}</span><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{info.count} AGENTS</span></div>
            <div className="modern-mono text-[11px] text-black/50 mt-3 leading-[1.4]">{info.description||"No description"}</div>
            <div className="mt-4 flex flex-wrap gap-1">{info.agents.map((a:string)=><span key={a} className="modern-mono text-[9px] bg-[#f5f5f5] border border-black/5 px-2 py-1 rounded-full">{a.toUpperCase()}</span>)}</div>
          </div>
        ))}
      </div>
      {skillMap.size===0 && <div className="rounded-[20px] border border-black/10 p-12 text-center modern-mono text-[11px] text-black/30">NO SKILLS DISCOVERED • REGISTER AGENT WITH SKILLS</div>}
    </div>
  );
}
