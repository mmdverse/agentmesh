"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StreamEvent {
  event: string;
  data: any;
  timestamp: string;
}

const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002";

export function TaskStream({ taskId }: { taskId: string }) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [taskState, setTaskState] = useState<string>("");

  useEffect(() => {
    const base = CP_URL;
    const url = `${base}/v1/tasks/${taskId}/stream`;
    let es: EventSource | null = null;

    try {
      es = new EventSource(url);
      es.onopen = () => {
        setConnected(true);
        setEvents(prev => [...prev, { event: "CONNECTED", data: { message: "Connected — Modern Luxury V2", url }, timestamp: new Date().toISOString() }]);
      };

      const add = (event: string) => (e: any) => {
        try {
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, { event: event.toUpperCase(), data, timestamp: new Date().toISOString() }]);
          if (data.state) setTaskState(data.state);
          if (data.task?.state) setTaskState(data.task.state);
        } catch {}
      };

      es.addEventListener("task", add("task"));
      es.addEventListener("state", add("state"));
      es.addEventListener("completed", (e:any)=>{ add("completed")(e); setTaskState("COMPLETED"); });
      es.addEventListener("failed", (e:any)=>{ add("failed")(e); setTaskState("FAILED"); });
      es.onerror = () => setConnected(false);
    } catch {
      setConnected(false);
    }

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${base}/v1/tasks/${taskId}`);
        const data = await res.json();
        if (data.task?.state && data.task.state !== taskState) {
          setTaskState(data.task.state);
          setEvents(prev => [...prev, { event: "POLL", data: data.task, timestamp: new Date().toISOString() }]);
        }
      } catch {}
    }, 3000);

    return () => { es?.close(); clearInterval(poll); setConnected(false); };
  }, [taskId]);

  return (
    <Card className="overflow-hidden border-black/10">
      <CardHeader className="bg-black text-white p-5">
        <CardTitle className="flex justify-between items-center">
          <span className="modern-label text-white/80">LIVE SSE STREAM — {taskId.slice(0,10).toUpperCase()}</span>
          <div className="flex gap-2">
            <span className={`modern-mono text-[10px] px-2.5 py-1 rounded-full ${connected ? "bg-white text-black" : "bg-white/10 text-white/40"}`}>{connected ? "● LIVE" : "○ OFF"}</span>
            {taskState && <span className="modern-mono text-[10px] bg-white/10 px-2.5 py-1 rounded-full border border-white/10">{taskState}</span>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-auto divide-y divide-black/5">
          {events.length===0 && <div className="p-4 modern-mono text-[11px] text-black/30">WAITING FOR EVENTS... {CP_URL}/v1/tasks/{taskId}/stream</div>}
          {events.map((ev,i)=>(
            <div key={i} className="p-4 hover:bg-[#fafafa]">
              <div className="flex justify-between"><span className="modern-label text-[9px] border border-black/10 rounded-full px-2 py-1">{ev.event}</span><span className="modern-mono text-[10px] text-black/30">{new Date(ev.timestamp).toLocaleTimeString()}</span></div>
              <pre className="mt-2 bg-[#f8f8f8] border border-black/5 rounded-xl p-3 text-[11px] modern-mono overflow-auto max-h-20 text-black/60">{JSON.stringify(ev.data, null, 2).slice(0, 500)}</pre>
            </div>
          ))}
        </div>
        <div className="p-3 bg-[#fafafa] border-t border-black/5 flex gap-2">
          <a href={`${CP_URL}/v1/tasks/${taskId}/stream`} target="_blank" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5 hover:bg-black hover:text-white transition-colors">SSE RAW</a>
          <a href={`${CP_URL}/v1/tasks/${taskId}/history`} target="_blank" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5 hover:bg-black hover:text-white transition-colors">HISTORY</a>
          <a href={`${CP_URL}/v1/tasks/${taskId}/graph`} target="_blank" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5 hover:bg-black hover:text-white transition-colors">GRAPH</a>
        </div>
      </CardContent>
    </Card>
  );
}
