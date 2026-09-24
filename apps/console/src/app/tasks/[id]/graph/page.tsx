"use client";

import { useEffect, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";

export default function TaskGraphPage({ params }: { params: { id: string } }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/tasks/${params.id}/graph`);
        const data = await res.json();
        const g = data.graph;
        if (g) {
          const flowNodes: Node[] = g.nodes.map((n: any, i: number) => ({
            id: n.id,
            data: { label: `${n.id.slice(0, 8)} (${n.state})` },
            position: { x: (i % 4) * 200, y: Math.floor(i / 4) * 100 },
            style: {
              background: n.state === "COMPLETED" ? "#bbf7d0" : n.state === "FAILED" ? "#fecaca" : n.state === "WORKING" ? "#bfdbfe" : "#fff",
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "10px",
              fontSize: "12px",
            },
          }));
          const flowEdges: Edge[] = g.edges.map((e: any) => ({
            id: `${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            label: e.agentId?.slice(0, 8),
            animated: true,
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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Live Task Graph: {params.id.slice(0, 16)}...</h1>
      <p className="text-xs text-muted-foreground">Real-time updates every 3s • Click nodes for details</p>
      <div className="h-[600px] border rounded bg-white">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
