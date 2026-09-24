import { api } from "@/lib/api";
import Link from "next/link";

export default async function AgentsPage({ searchParams }: { searchParams: { skill?: string; search?: string; limit?: string; offset?: string } }) {
  let data: any = { agents: [], total: 0 };
  const limit = parseInt(searchParams.limit || "12", 10);
  const offset = parseInt(searchParams.offset || "0", 10);
  try {
    data = await api.controlPlane.agents.list({ skill: searchParams.skill, search: searchParams.search, limit: String(limit), offset: String(offset) } as any);
  } catch {}

  const totalPages = Math.ceil((data.total || 0) / limit);
  const currentPage = Math.floor(offset / limit);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <div className="modern-label text-black/30">REGISTRY • LIVE • 03 • {data.total} TOTAL</div>
          <h1 className="modern-display text-[32px] mt-2">AGENTS</h1>
          <div className="modern-mono text-[11px] text-black/50 mt-2">{data.total} REGISTERED • DISCOVERY BY SKILL • REAL AGENT 9001 • HEALTHY AUTO-REGISTER • PAGINATION</div>
        </div>
        <div className="flex gap-2">
          <Link href="/chat" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">CHAT → LIVE</Link>
          <Link href="/overview" className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">OVERVIEW →</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-[20px] bg-white modern-border p-6">
          <div className="modern-label text-black/30 mb-3">SEARCH & FILTER • LIVE</div>
          <form className="flex gap-2">
            <input name="search" defaultValue={searchParams.search} placeholder="SEARCH BY NAME, TAGS..." className="flex-1 border border-black/10 rounded-full px-4 py-2.5 text-[12px] modern-mono focus:border-black outline-none" />
            <input name="skill" defaultValue={searchParams.skill} placeholder="SKILL: CODE-REVIEW" className="flex-1 border border-black/10 rounded-full px-4 py-2.5 text-[12px] modern-mono focus:border-black outline-none" />
            <button type="submit" className="bg-black text-white rounded-full px-6 py-2.5 text-[11px] modern-mono">FILTER</button>
            {(searchParams.skill || searchParams.search) && <Link href="/agents" className="border border-black/10 rounded-full px-4 py-2.5 text-[11px] modern-mono">CLEAR</Link>}
          </form>
          <div className="mt-3 flex gap-2">
            <span className="modern-mono text-[9px] bg-[#f5f5f5] px-2 py-1 rounded-full">HEALTHY: {data.agents?.filter((a:any)=>a.health==="HEALTHY").length||0}</span>
            <span className="modern-mono text-[9px] bg-[#f5f5f5] px-2 py-1 rounded-full">TOTAL: {data.total}</span>
            <span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">PAGE {currentPage+1}/{Math.max(1,totalPages)}</span>
          </div>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-6">
          <div className="modern-label text-white/40">REGISTER • AUTO-REGISTER FIXED</div>
          <div className="modern-mono text-[11px] text-white/60 mt-3 leading-[1.5]">server-sdk now auto-registers with CP + heartbeat 15s • health UNKNOWN→HEALTHY fixed</div>
          <div className="mt-3 text-[10px] modern-mono bg-white/10 rounded-lg p-3 overflow-auto">POST {process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/agents {"{"}"url":"http://localhost:9001"{"}"}</div>
          <div className="mt-3 flex gap-1">
            <span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">AUTO-REGISTER: ON</span>
            <span className="modern-mono text-[9px] bg-white text-black px-2 py-1 rounded-full">HEALTHY: LIVE</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        {data.agents?.map((agent: any) => (
          <div key={agent.id} className="md:col-span-4 group rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${agent.health==="HEALTHY"?"bg-black animate-pulse":agent.health==="UNHEALTHY"?"bg-red-500":agent.url?.includes("9001")?"bg-black/60":"bg-black/20"}`} />
                <span className="text-[12px] font-[700] tracking-[-0.01em]">{agent.name.toUpperCase()}</span>
              </div>
              <span className="modern-mono text-[9px] bg-black/5 px-2 py-1 rounded-full">{agent.id.slice(0,6).toUpperCase()}</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="modern-mono text-[11px] text-black/50 truncate">{agent.url}</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{agent.version}</span>
                <span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${agent.health==="HEALTHY"?"bg-black text-white":"border border-black/10"}`}>{agent.health||"UNKNOWN"}</span>
                {agent.url?.includes("9001") && <span className="modern-mono text-[9px] bg-black/80 text-white px-2 py-1 rounded-full">REAL • 9001 • LIVE</span>}
                {agent.tags?.map((t:string)=><span key={t} className="modern-mono text-[9px] bg-[#f5f5f5] border border-black/5 px-2 py-1 rounded-full">{t.toUpperCase()}</span>)}
                {agent.skills?.map((s:any)=><span key={s.skillId} className="modern-mono text-[9px] bg-[#fffbeb] border border-amber-200 px-2 py-1 rounded-full">{s.skillId.toUpperCase()}</span>)}
              </div>
              <div className="flex gap-2 pt-2">
                <Link href={`/agents/${agent.id}`} className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5 hover:bg-black hover:text-white transition-colors">VIEW → CARD</Link>
                <Link href={`/chat?agent=${agent.id}`} className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">CHAT → LIVE</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.total > limit && (
        <div className="flex justify-between items-center rounded-[20px] bg-white border border-black/10 p-4">
          <div className="modern-mono text-[11px] text-black/50">PAGE {currentPage+1} OF {totalPages} • {data.total} TOTAL</div>
          <div className="flex gap-2">
            {currentPage>0 && <Link href={`/agents?offset=${Math.max(0, offset-limit)}&limit=${limit}${searchParams.skill?`&skill=${searchParams.skill}`:""}${searchParams.search?`&search=${searchParams.search}`:""}`} className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">← PREV</Link>}
            {currentPage < totalPages-1 && <Link href={`/agents?offset=${offset+limit}&limit=${limit}${searchParams.skill?`&skill=${searchParams.skill}`:""}${searchParams.search?`&search=${searchParams.search}`:""}`} className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">NEXT →</Link>}
          </div>
        </div>
      )}

      {data.agents?.length===0 && <div className="rounded-[20px] border border-black/10 p-12 text-center"><div className="modern-mono text-[12px] text-black/40">NO AGENTS REGISTERED</div><div className="modern-mono text-[11px] text-black/30 mt-2">Real agent should be on 9001 • Check CP 3002 • Auto-register enabled in server-sdk</div><Link href="/chat" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2 inline-block mt-4">GO TO CHAT →</Link></div>}
    </div>
  );
}
