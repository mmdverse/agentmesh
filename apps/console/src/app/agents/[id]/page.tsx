import { api } from "@/lib/api";
import Link from "next/link";

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  let agent: any = null, card: any = null;
  try { const res = await api.controlPlane.agents.get(params.id); agent = res.agent; } catch {}
  try { const res = await api.controlPlane.agents.getCard(params.id); card = res.card; } catch {}

  if (!agent) return <div className="p-10"><div className="modern-label text-black/30">AGENT NOT FOUND</div><div className="modern-mono text-[11px] mt-2">{params.id}</div><Link href="/agents" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2 inline-block mt-4">← AGENTS</Link></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div><div className="modern-label text-black/30">AGENT • LIVE • DETAIL</div><h1 className="modern-display text-[28px] mt-2">{agent.name.toUpperCase()}</h1><div className="flex gap-2 mt-3"><span className="modern-mono text-[10px] bg-black text-white px-2.5 py-1 rounded-full">{agent.version}</span><span className="modern-mono text-[10px] border border-black/10 px-2.5 py-1 rounded-full">{agent.health}</span><span className="modern-mono text-[10px] bg-[#f5f5f5] border border-black/5 px-2.5 py-1 rounded-full">{agent.trustLevel}</span>{agent.url?.includes("9001") && <span className="modern-mono text-[10px] bg-black/80 text-white px-2.5 py-1 rounded-full">REAL • 9001</span>}</div></div>
        <div className="flex gap-2"><Link href="/agents" className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">← AGENTS</Link><Link href={`/chat?agent=${agent.id}`} className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">CHAT →</Link></div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">DETAILS</div>
          <div className="mt-4 space-y-3 modern-mono text-[11px]">
            <div className="flex justify-between"><span className="text-black/40">ID</span><span className="text-[10px]">{agent.id}</span></div>
            <div className="flex justify-between"><span className="text-black/40">URL</span><span className="text-[10px] truncate max-w-[200px]">{agent.url}</span></div>
            <div className="flex justify-between"><span className="text-black/40">ORG</span><span>{agent.organizationId||"default"}</span></div>
            <div className="flex justify-between"><span className="text-black/40">PROJECT</span><span>{agent.projectId||"default"}</span></div>
            <div className="flex justify-between"><span className="text-black/40">REGION</span><span>{agent.region||"—"}</span></div>
            <div className="flex justify-between"><span className="text-black/40">ENV</span><span>{agent.environment}</span></div>
            <div className="flex justify-between"><span className="text-black/40">LAST SEEN</span><span className="text-[10px]">{agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : "—"}</span></div>
            <div className="pt-3 border-t border-black/5"><div className="text-black/30 text-[10px]">DESCRIPTION</div><div className="mt-1 text-[12px] leading-[1.4]">{agent.description||"No description"}</div></div>
          </div>
        </div>
        <div className="md:col-span-6 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">SKILLS • {agent.skills?.length||0}</div>
          <div className="mt-4 space-y-2 max-h-[400px] overflow-auto">
            {agent.skills?.map((s:any)=><div key={s.skillId} className="rounded-xl bg-white/5 border border-white/10 p-4"><div className="flex justify-between"><span className="text-[11px] font-[600]">{s.name?.toUpperCase()}</span><span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">{s.skillId}</span></div><div className="modern-mono text-[10px] text-white/50 mt-2">{s.description}</div><div className="flex gap-1 mt-2">{s.tags?.map((t:string)=><span key={t} className="modern-mono text-[8px] border border-white/15 px-1.5 py-0.5 rounded-full">{t.toUpperCase()}</span>)}</div></div>)}
            {(!agent.skills || agent.skills.length===0) && <div className="modern-mono text-[11px] text-white/30 text-center p-4">NO SKILLS</div>}
          </div>
        </div>
      </div>

      {card && <div className="rounded-[20px] bg-[#fafafa] border border-black/10 p-7"><div className="modern-label text-black/30">AGENT CARD • JSON</div><pre className="mt-4 bg-white border border-black/5 rounded-xl p-4 text-[10px] modern-mono overflow-auto max-h-[400px]">{JSON.stringify(card, null, 2)}</pre></div>}
    </div>
  );
}
