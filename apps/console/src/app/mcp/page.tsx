import { api } from "@/lib/api";

export default async function MCPPage() {
  let servers: any = { servers: [] };
  try { servers = await api.controlPlane.mcp.servers(); } catch {}

  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">MCP BRIDGE • PROTOCOL SEPARATION • 11</div><h1 className="modern-display text-[32px] mt-2">MCP</h1><div className="modern-mono text-[11px] text-black/50 mt-2">A2A ↔ AGENTMESH ↔ MCP • TRANSLATION LAYER • TOOL → SKILL MAPPING</div></div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-7 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">PROTOCOL FLOW</div>
          <pre className="mt-4 bg-[#fafafa] border border-black/5 rounded-xl p-4 text-[11px] modern-mono leading-[1.5]">{`A2A Agent → Gateway → MCP Bridge → MCP Tool
MCP Tool → AgentMesh → A2A Agent

Translation:
- MCP Tool → A2A Skill (mcp_{tool.name}, tags: [mcp, tool])
- MCP Server → A2A Agent Card
- Keep protocols separate, clear abstraction`}</pre>
        </div>
        <div className="md:col-span-5 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">SERVERS • {servers.servers?.length||0}</div>
          <div className="mt-4 space-y-2">
            {servers.servers?.map((s:any,i:number)=><div key={i} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 modern-mono text-[11px]">{s.name||s.id||JSON.stringify(s).slice(0,60)}</div>)}
            {(!servers.servers || servers.servers.length===0) && <div className="modern-mono text-[11px] text-white/30 p-4 text-center">NO MCP SERVERS</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
