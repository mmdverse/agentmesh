import { api } from "@/lib/api";
import Link from "next/link";
import { TaskStream } from "@/components/task-stream";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  let task: any = null, history: any = [], graph: any = null;
  try { const res = await api.controlPlane.tasks.get(params.id); task = res.task; } catch {}
  try { const res = await api.controlPlane.tasks.history(params.id); history = res.history; } catch {}
  try { const res = await api.controlPlane.tasks.graph(params.id); graph = res.graph; } catch {}

  if (!task) return <div className="p-10"><div className="modern-label text-black/30">TASK NOT FOUND</div><div className="modern-mono text-[11px] mt-2">{params.id}</div><Link href="/tasks" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2 inline-block mt-4">← TASKS</Link></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div><div className="modern-label text-black/30">TASK • LIVE • DETAIL</div><h1 className="modern-display text-[24px] mt-2 flex items-center gap-3">{task.id.slice(0,16).toUpperCase()}... <span className="modern-mono text-[10px] bg-black text-white px-2.5 py-1 rounded-full">{task.state}</span></h1><div className="modern-mono text-[11px] text-black/40 mt-2">Trace {task.traceId?.slice(0,12)} • Root {task.rootTaskId?.slice(0,12)} • Parent {task.parentTaskId?.slice(0,12)||"none"}</div></div>
        <div className="flex gap-2"><Link href="/tasks" className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">← TASKS</Link><Link href={`/tasks/${params.id}/graph`} className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">GRAPH → LIVE</Link></div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">DETAILS • LIVE</div>
          <div className="mt-4 space-y-3 modern-mono text-[11px]">
            <div className="flex justify-between"><span className="text-black/40">ID</span><span className="text-[10px]">{task.id}</span></div>
            <div className="flex justify-between"><span className="text-black/40">STATE</span><span className="bg-black text-white px-2 py-1 rounded-full text-[9px]">{task.state}</span></div>
            <div className="flex justify-between"><span className="text-black/40">ATTEMPTS</span><span>{task.attempts}/{task.maxAttempts}</span></div>
            <div className="flex justify-between"><span className="text-black/40">AGENT</span><Link href={`/agents/${task.agentId}`} className="underline text-[10px]">{task.agentId.slice(0,20)}...</Link></div>
            <div className="flex justify-between"><span className="text-black/40">SESSION</span><span className="text-[10px]">{task.sessionId?.slice(0,16)}...</span></div>
            <div className="flex justify-between"><span className="text-black/40">TRACE</span><Link href={`/telemetry?traceId=${task.traceId}`} className="underline text-[10px]">{task.traceId?.slice(0,16)}...</Link></div>
            <div className="flex justify-between"><span className="text-black/40">CREATED</span><span className="text-[10px]">{new Date(task.createdAt).toLocaleString()}</span></div>
          </div>
        </div>
        <div className="md:col-span-6 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">INPUT / OUTPUT</div>
          <div className="mt-4 space-y-3">
            <div><div className="modern-mono text-[10px] text-white/40">INPUT</div><pre className="mt-1 bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] modern-mono text-white/70 overflow-auto max-h-32">{JSON.stringify(task.input, null, 2)}</pre></div>
            {task.output && <div><div className="modern-mono text-[10px] text-white/40">OUTPUT</div><pre className="mt-1 bg-white text-black rounded-xl p-3 text-[11px] modern-mono overflow-auto max-h-32">{JSON.stringify(task.output, null, 2)}</pre></div>}
            {task.error && <div><div className="modern-mono text-[10px] text-red-400">ERROR</div><pre className="mt-1 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-[11px] modern-mono text-red-300 overflow-auto max-h-32">{JSON.stringify(task.error, null, 2)}</pre></div>}
          </div>
        </div>
      </div>

      <TaskStream taskId={params.id} />

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">HISTORY • {history.length}</div>
          <div className="mt-4 space-y-1 max-h-[200px] overflow-auto">
            {history.map((h:any)=><div key={h.id} className="flex gap-2 text-[11px] modern-mono border-b border-black/5 py-2 last:border-0"><span className="text-black/30">{new Date(h.timestamp).toLocaleTimeString()}</span><span className="bg-[#f5f5f5] px-2 py-0.5 rounded-full text-[10px]">{h.fromState||"none"} → {h.toState}</span><span className="text-black/40">{h.reason}</span></div>)}
            {history.length===0 && <div className="modern-mono text-[11px] text-black/30">No history</div>}
          </div>
        </div>
        <div className="md:col-span-6 rounded-[20px] bg-[#fafafa] border border-black/10 p-7">
          <div className="modern-label text-black/30">GRAPH • {graph?.nodes?.length||0} NODES • {graph?.edges?.length||0} EDGES</div>
          <pre className="mt-4 bg-white border border-black/5 rounded-xl p-3 text-[10px] modern-mono max-h-[200px] overflow-auto">{JSON.stringify(graph, null, 2)?.slice(0,2000)||"No graph"}</pre>
          <Link href={`/tasks/${params.id}/graph`} className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2 inline-block mt-4">OPEN LIVE GRAPH →</Link>
        </div>
      </div>
    </div>
  );
}
