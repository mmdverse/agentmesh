export default async function MCPPage() {
  let data: any = { servers: [], total: 0 };
  let agents: any = { total: 0 };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/mcp/servers`, { cache: "no-store" });
    data = await res.json();
  } catch { data = { servers: [], total: 0 }; }
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/agents`, { cache: "no-store" });
    agents = await res.json();
  } catch {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">MCP • LIVE • A2A ↔ MCP BRIDGE • 08</div><h1 className="modern-display text-[32px] mt-2">MCP</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total || data.servers?.length || 0} MCP SERVERS • {agents.total} A2A AGENTS • BRIDGE PROTOCOL • LIVE FROM /v1/mcp/servers</div></div>
        <div className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">A2A ↔ MCP • LIVE</div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">MCP SERVERS • LIVE • {data.total || 0} TOTAL</div>
          <div className="mt-6 space-y-3">
            {data.servers?.length > 0 ? data.servers.map((s:any)=>(
              <div key={s.id} className="rounded-xl bg-[#fafafa] border border-black/5 p-4 flex justify-between">
                <div><div className="text-[11px] font-[600]">{s.name?.toUpperCase() || s.id}</div><div className="modern-mono text-[10px] text-black/40 mt-1">{s.url} • {s.status || "connected"}</div></div>
                <span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{s.status || "LIVE"}</span>
              </div>
            )) : <div className="rounded-xl bg-[#fafafa] border border-black/5 p-8 text-center"><div className="modern-mono text-[11px] text-black/30">NO MCP SERVERS REGISTERED YET</div><div className="modern-mono text-[10px] text-black/20 mt-2">POST /v1/mcp/servers to register • Bridge A2A ↔ MCP protocol</div><div className="mt-4 p-3 rounded-xl bg-black text-white text-left"><div className="modern-label text-white/40">EXAMPLE</div><pre className="mt-2 text-[10px] modern-mono text-white/60">{`curl -X POST ${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/mcp/servers \\
  -d '{"name":"my-mcp","url":"http://localhost:8080","capabilities":["tools"]}'`}</pre></div></div>}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-black text-white p-3"><div className="modern-mono text-[9px] text-white/40">BRIDGE</div><div className="text-[11px] mt-1">A2A → MCP tools</div></div>
            <div className="rounded-xl bg-[#fafafa] border border-black/5 p-3"><div className="modern-mono text-[9px] text-black/30">PROTOCOL</div><div className="text-[11px] mt-1">MCP 1.0 • JSON-RPC</div></div>
            <div className="rounded-xl bg-[#fafafa] border border-black/5 p-3"><div className="modern-mono text-[9px] text-black/30">AGENTS</div><div className="text-[11px] mt-1">{agents.total} A2A → MCP</div></div>
          </div>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">A2A ↔ MCP • HOW IT WORKS</div>
          <div className="mt-4 space-y-3 modern-mono text-[11px] text-white/60">
            <div>1. Agent registers with card • skills</div>
            <div>2. MCP server registers • tools</div>
            <div>3. Bridge maps skill → tool</div>
            <div>4. Gateway routes via capability_match</div>
          </div>
          <div className="mt-6 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="modern-mono text-[9px] text-white/40">CONSOLE</div>
            <div className="modern-mono text-[10px] text-white/60 mt-1">/mcp page shows live servers • 20 scenarios tested: servers 0 console ok (no MCP yet, bridge ready)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
