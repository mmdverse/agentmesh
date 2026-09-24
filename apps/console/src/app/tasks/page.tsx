import { api } from "@/lib/api";
import Link from "next/link";

export default async function TasksPage({ searchParams }: { searchParams?: { limit?: string; offset?: string; state?: string } }) {
  let data: any = { tasks: [], total: 0 };
  const limit = parseInt(searchParams?.limit || "20", 10);
  const offset = parseInt(searchParams?.offset || "0", 10);
  const stateFilter = searchParams?.state;
  try { data = await api.controlPlane.tasks.list({ limit: String(limit), offset: String(offset), ...(stateFilter ? { state: stateFilter } : {}) } as any); } catch {}

  const byState = data.tasks?.reduce((acc:any, t:any)=>{ acc[t.state]=(acc[t.state]||0)+1; return acc; }, {}) || {};
  const totalPages = Math.ceil((data.total || 0) / limit);
  const currentPage = Math.floor(offset / limit);
  const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <div className="modern-label text-black/30">TASKS • LIVE • 04 • {data.total} TOTAL</div>
          <h1 className="modern-display text-[32px] mt-2">TASKS</h1>
          <div className="modern-mono text-[11px] text-black/50 mt-2">{data.total} TOTAL • {byState.COMPLETED||0} COMPLETED • {byState.FAILED||0} FAILED • SSE STREAMING • DELEGATION TREE • PAGINATION</div>
        </div>
        <div className="flex gap-2">
          <Link href="/tasks?state=COMPLETED" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">COMPLETED</Link>
          <Link href="/tasks?state=FAILED" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">FAILED</Link>
          <Link href="/tasks" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">ALL</Link>
          <Link href="/chat" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">CHAT → CREATE</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-9 rounded-[20px] bg-white modern-border p-7">
          <div className="modern-label text-black/30">LIVE STATES • PAGE {currentPage+1}/{Math.max(1,totalPages)}</div>
          <div className="mt-6 grid grid-cols-3 gap-8">
            {[
              { label: "COMPLETED", value: byState.COMPLETED||0, color: "bg-black" },
              { label: "WORKING", value: byState.WORKING||0, color: "bg-black/60" },
              { label: "FAILED", value: byState.FAILED||0, color: "bg-black/20" },
            ].map(m => (
              <div key={m.label}>
                <div className="modern-mono text-[10px] tracking-[0.08em] text-black/40">{m.label}</div>
                <div className="modern-display text-[36px] mt-1">{m.value}</div>
                <div className="mt-3 h-1 bg-black/5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${m.color}`} style={{width: `${Math.max(12, (m.value/Math.max(1,data.total))*100)}%`}} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-3 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">STREAMING • LIVE</div>
          <div className="mt-4 space-y-2 text-[11px] modern-mono text-white/70">
            <div>GET /v1/tasks/:id/stream → SSE</div>
            <div>GET /v1/tasks/:id/history → transitions</div>
            <div>GET /v1/tasks/:id/graph → React Flow</div>
            <div className="pt-2 border-t border-white/10 mt-3 text-[10px] text-white/40">CP: {CP_URL}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.tasks?.map((task: any) => (
          <div key={task.id} className="group rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${task.state==="COMPLETED"?"bg-black":task.state==="WORKING"?"bg-black/60 animate-pulse":task.state==="FAILED"?"bg-red-500":"bg-black/20"}`} />
                <span className="modern-mono text-[11px] font-[500]">{task.id.slice(0,20).toUpperCase()}...</span>
                <span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${task.state==="COMPLETED"?"bg-black text-white":task.state==="FAILED"?"bg-red-500 text-white":"bg-black/10"}`}>{task.state}</span>
                <span className="modern-mono text-[9px] bg-[#f5f5f5] px-2 py-1 rounded-full">{task.attempts||1} ATTEMPTS</span>
              </div>
              <span className="modern-mono text-[10px] text-black/30">{new Date(task.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-4 grid md:grid-cols-12 gap-4">
              <div className="md:col-span-8 space-y-2">
                <div className="modern-mono text-[10px] text-black/40">AGENT: {task.agentId.slice(0,20)}... • SESSION: {task.sessionId?.slice(0,8)} • TRACE: {task.traceId?.slice(0,8)} • ROOT: {task.rootTaskId?.slice(0,8)}</div>
                <div className="rounded-xl bg-[#fafafa] border border-black/5 p-3">
                  <div className="modern-label text-[9px] text-black/30">INPUT</div>
                  <div className="modern-mono text-[11px] mt-1 truncate">{JSON.stringify(task.input)?.slice(0, 200)}</div>
                  {task.output && <><div className="modern-label text-[9px] text-black/30 mt-3">OUTPUT</div><div className="modern-mono text-[11px] mt-1 truncate text-black">{JSON.stringify(task.output)?.slice(0, 200)}</div></>}
                  {task.error && <><div className="modern-label text-[9px] text-red-500 mt-3">ERROR</div><div className="modern-mono text-[11px] mt-1 truncate text-red-600">{JSON.stringify(task.error)?.slice(0, 200)}</div></>}
                </div>
              </div>
              <div className="md:col-span-4 flex flex-col gap-2">
                <Link href={`/tasks/${task.id}`} className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2 text-center hover:bg-black hover:text-white transition-colors">VIEW → DETAIL</Link>
                <Link href={`/tasks/${task.id}/graph`} className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2 text-center hover:bg-black hover:text-white transition-colors">GRAPH → LIVE FLOW</Link>
                <a href={`${CP_URL}/v1/tasks/${task.id}/stream`} target="_blank" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2 text-center">SSE STREAM • LIVE</a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.total > limit && (
        <div className="flex justify-between items-center rounded-[20px] bg-white border border-black/10 p-4">
          <div className="modern-mono text-[11px] text-black/50">PAGE {currentPage+1} OF {totalPages} • {data.total} TOTAL • {limit} PER PAGE</div>
          <div className="flex gap-2">
            {currentPage>0 && <Link href={`/tasks?offset=${Math.max(0, offset-limit)}&limit=${limit}${stateFilter?`&state=${stateFilter}`:""}`} className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">← PREV</Link>}
            {currentPage < totalPages-1 && <Link href={`/tasks?offset=${offset+limit}&limit=${limit}${stateFilter?`&state=${stateFilter}`:""}`} className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">NEXT →</Link>}
          </div>
        </div>
      )}

      {data.tasks?.length===0 && <div className="rounded-[20px] border border-black/10 p-12 text-center"><div className="modern-mono text-[12px] text-black/30">NO TASKS YET • CREATE VIA CHAT UI • FILTER: {stateFilter||"ALL"}</div><Link href="/chat" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2 inline-block mt-4">CHAT → CREATE TASK</Link></div>}
    </div>
  );
}
