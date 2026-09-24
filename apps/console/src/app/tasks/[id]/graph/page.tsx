"use client";

import { useEffect, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import Link from "next/link";

const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002";

export default function TaskGraphPage({ params }: { params: { id: string } }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [stats, setStats] = useState({ nodes:0, edges:0 });

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch(`${CP_URL}/v1/tasks/${params.id}/graph`);
        const data = await res.json();
        const g = data.graph;
        if (g) {
          setStats({ nodes: g.nodes?.length||0, edges: g.edges?.length||0 });
          const flowNodes: Node[] = g.nodes.map((n: any, i: number) => ({
            id: n.id,
            data: { label: `${n.id.slice(0, 8).toUpperCase()} • ${n.state}` },
            position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 },
            style: {
              background: n.state === "COMPLETED" ? "#000" : n.state === "FAILED" ? "#fff" : n.state === "WORKING" ? "#f5f5f5" : "#fff",
              color: n.state === "COMPLETED" ? "#fff" : "#000",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: "16px",
              padding: "12px 16px",
              fontSize: "11px",
              fontFamily: "Geist Mono, monospace",
              fontWeight: "600",
            },
          }));
          const flowEdges: Edge[] = g.edges.map((e: any) => ({
            id: `${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            label: e.agentId?.slice(0, 6).toUpperCase(),
            animated: true,
            style: { stroke: "#000" },
          }));
          setNodes(flowNodes);
          setEdges(flowEdges);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchGraph();
    const interval = setInterval(fetchGraph, 3000);
    return () => clearInterval(interval);
  }, [params.id]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">GRAPH • LIVE • REACT FLOW</div><h1 className="modern-display text-[28px] mt-2">TASK GRAPH — {params.id.slice(0,12).toUpperCase()}</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{stats.nodes} NODES • {stats.edges} EDGES • REAL-TIME 3S • MODERN LUXURY V2</div></div>
        <div className="flex gap-2"><Link href={`/tasks/${params.id}`} className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">← TASK</Link><Link href="/tasks" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">TASKS →</Link></div>
      </div>
      <div className="rounded-[24px] bg-white border border-black/10 overflow-hidden modern-shadow-lg">
        <div className="p-5 border-b border-black/5 bg-[#fcfcfc] flex justify-between"><span className="modern-label text-black/30">DELEGATION TREE</span><span className="modern-mono text-[10px] bg-black text-white px-2.5 py-1 rounded-full">LIVE • 3S POLL</span></div>
        <div className="h-[600px] bg-white"><ReactFlow nodes={nodes} edges={edges} fitView><Background color="rgba(0,0,0,0.04)" gap={24} /><Controls /><MiniMap style={{ background: "#fafafa", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "12px" }} /></ReactFlow></div>
      </div>
      <div className="rounded-[20px] bg-black text-white p-6"><div className="modern-label text-white/40">ENDPOINT</div><div className="modern-mono text-[11px] text-white/60 mt-2">{CP_URL}/v1/tasks/{params.id}/graph — JSON</div></div>
    </div>
  );
}
