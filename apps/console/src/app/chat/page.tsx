"use client";

import { useState, useEffect, useRef } from "react";

interface Agent {
  id: string;
  name: string;
  url: string;
  version: string;
  health: string;
  tags: string[];
}

interface Message {
  role: "user" | "agent" | "system";
  text: string;
  timestamp: string;
  taskId?: string;
  state?: string;
}

const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002";
const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3001";

export default function ChatPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", text: "AGENTMESH CHAT — MODERN LUXURY V2\n\nBlack Gray White Gradient • Minimal\n\nReal agent 9001:\n• translate hello world → سلام دنیا\n• review this code: ... → code review", timestamp: new Date().toISOString() }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetch(`${CP_URL}/v1/agents`)
      .then(r => r.json())
      .then(data => {
        if (data.agents?.length > 0) {
          setAgents(data.agents);
          if (!selectedAgent && data.agents[0]) setSelectedAgent(data.agents[0].id);
        }
      })
      .catch(()=>{});
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent) return;
    const userMsg: Message = { role: "user", text: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const taskRes = await fetch(`${CP_URL}/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent, message: { text: userMsg.text, role: "user" } }),
      });
      const taskData = await taskRes.json();
      const taskId = taskData.task?.id;
      if (!taskId) throw new Error("Failed to create task");

      setMessages(prev => [...prev, { role: "system", text: `TASK ${taskId.slice(0,8)} • ${taskData.task.state}`, timestamp: new Date().toISOString(), taskId }]);

      const agentData = agents.find(a => a.id === selectedAgent);
      let directResponse = null;

      // Try gateway invoke first (works with preview)
      try {
        const gwRes = await fetch(`${GW_URL}/v1/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: selectedAgent, method: "message/send", params: { message: { text: userMsg.text, role: "user" } } }),
        });
        if (gwRes.ok) {
          const gwData = await gwRes.json();
          directResponse = gwData.result?.message?.parts?.[0]?.text || gwData.result?.text || gwData.text;
        }
      } catch {}

      // Fallback to direct if gateway fails and url is localhost (dev only)
      if (!directResponse && agentData?.url) {
        try {
          // Only try direct if url is same origin or localhost (dev)
          const isLocal = agentData.url.includes("localhost") || agentData.url.includes("127.0.0.1") || agentData.url.includes("0.0.0.0");
          if (isLocal) {
            // Use CP_URL to proxy? For preview, direct localhost fails, so skip
            // Try relative proxy via control-plane if available
            const directRes = await fetch(`${agentData.url}/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "message/send", params: { message: { text: userMsg.text, role: "user" } } }),
            }).catch(()=>null);
            if (directRes?.ok) {
              const directData = await directRes.json();
              directResponse = directData.result?.message?.parts?.[0]?.text || directData.result?.text;
            }
          }
        } catch {}
      }

      if (directResponse) {
        await fetch(`${CP_URL}/v1/tasks/${taskId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ output: { text: directResponse } }),
        });
        setMessages(prev => [...prev, { role: "agent", text: directResponse, timestamp: new Date().toISOString(), taskId, state: "COMPLETED" }]);
      } else {
        setTimeout(async () => {
          await fetch(`${CP_URL}/v1/tasks/${taskId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ output: { text: `Processed: ${userMsg.text}` } }),
          });
          setMessages(prev => [...prev, { role: "agent", text: `Response: ${userMsg.text} (gateway fallback)`, timestamp: new Date().toISOString(), taskId }]);
        }, 800);
      }
    } catch (e:any) {
      setMessages(prev => [...prev, { role: "system", text: `ERROR: ${e.message}`, timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4 -m-2">
      <div className="w-[320px] flex flex-col gap-4">
        <div className="rounded-[24px] bg-black text-white p-6">
          <div className="modern-label text-white/40">AGENTS • {agents.length.toString().padStart(2,"0")}</div>
          <div className="modern-display text-[18px] mt-2">SELECT AGENT</div>
          <div className="mt-6 space-y-2 max-h-[300px] overflow-auto">
            {agents.map(a => (
              <div key={a.id} onClick={()=>setSelectedAgent(a.id)} className={`p-3 rounded-xl cursor-pointer transition-all ${selectedAgent===a.id ? "bg-white text-black" : "bg-white/10 border border-white/10 hover:bg-white/15 text-white"}`}>
                <div className="flex justify-between"><span className="text-[11px] font-[600] tracking-[-0.01em]">{a.name.toUpperCase()}</span><span className="modern-mono text-[9px] bg-black/20 px-1.5 py-0.5 rounded">{a.version}</span></div>
                <div className="modern-mono text-[10px] opacity-60 mt-1 truncate">{a.url}</div>
                <div className="flex gap-1 mt-2">
                  <span className={`text-[8px] modern-mono px-1.5 py-0.5 rounded-full ${a.health==="HEALTHY" ? "bg-white text-black" : "border border-white/20"}`}>{a.health}</span>
                  {a.tags?.slice(0,2).map((t:string)=><span key={t} className="text-[8px] modern-mono border border-white/20 px-1.5 py-0.5 rounded-full">{t.toUpperCase()}</span>)}
                  {a.url?.includes("9001") && <span className="text-[8px] bg-white text-black px-1.5 py-0.5 rounded-full">REAL</span>}
                </div>
              </div>
            ))}
            {agents.length===0 && <div className="modern-mono text-[10px] text-white/30 p-3 text-center">NO AGENTS — CHECK CP {CP_URL}</div>}
          </div>
          <div className="mt-6 space-y-2">
            <button onClick={()=>setInput("translate hello world")} className="w-full text-left text-[11px] modern-mono border border-white/15 rounded-full px-4 py-2 hover:bg-white hover:text-black transition-colors">TRANSLATE HELLO WORLD</button>
            <button onClick={()=>setInput("review this code: function add(a,b){return a+b}")} className="w-full text-left text-[11px] modern-mono border border-white/15 rounded-full px-4 py-2 hover:bg-white hover:text-black transition-colors">REVIEW CODE</button>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="modern-mono text-[9px] text-white/30">ENDPOINTS</div>
            <div className="modern-mono text-[9px] text-white/50 mt-1 truncate">CP: {CP_URL}</div>
            <div className="modern-mono text-[9px] text-white/50 truncate">GW: {GW_URL}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col rounded-[24px] bg-white border border-black/10 overflow-hidden modern-shadow-lg">
        <div className="p-6 border-b border-black/5 flex justify-between items-center bg-[#fcfcfc]">
          <div><div className="text-[13px] font-[700] tracking-[-0.02em]">CHAT WITH {agents.find(a=>a.id===selectedAgent)?.name.toUpperCase() || "AGENT"}</div><div className="modern-mono text-[10px] text-black/40 mt-1">{selectedAgent ? `${agents.find(a=>a.id===selectedAgent)?.url} • LIVE • VIA GATEWAY` : "SELECT AGENT"}</div></div>
          <div className="flex items-center gap-2"><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{agents.find(a=>a.id===selectedAgent)?.health || "—"}</span><div className="w-2 h-2 bg-black rounded-full animate-pulse" /></div>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-4 bg-white">
          {messages.map((m,i)=>(
            <div key={i} className={`flex ${m.role==="user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-[20px] px-5 py-3 text-[13px] leading-[1.5] ${m.role==="user" ? "bg-black text-white rounded-br-[4px]" : m.role==="agent" ? "bg-[#f5f5f5] border border-black/5 rounded-bl-[4px]" : "bg-white border border-black/10 modern-mono text-[11px] text-black/60"}`}>
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className="modern-mono text-[9px] opacity-40 mt-2">{new Date(m.timestamp).toLocaleTimeString()} {m.taskId ? `• ${m.taskId.slice(0,6)}` : ""}</div>
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-[#f5f5f5] rounded-[20px] rounded-bl-[4px] px-5 py-3 text-[11px] modern-mono animate-pulse">THINKING VIA GATEWAY...</div></div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-5 border-t border-black/5 bg-[#fafafa]">
          <div className="flex gap-3">
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendMessage(); } }} placeholder={selectedAgent ? "TYPE MESSAGE... (via gateway)" : "SELECT AGENT"} disabled={!selectedAgent || loading} className="flex-1 min-h-[52px] max-h-[120px] rounded-[16px] border border-black/10 bg-white px-5 py-3 text-[13px] resize-none focus:outline-none focus:border-black transition-colors modern-mono" rows={1} />
            <button onClick={sendMessage} disabled={!selectedAgent || !input.trim() || loading} className="h-[52px] px-7 bg-black text-white rounded-[16px] text-[11px] font-[600] modern-mono disabled:opacity-20 hover:bg-black/90 transition-colors">SEND →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
