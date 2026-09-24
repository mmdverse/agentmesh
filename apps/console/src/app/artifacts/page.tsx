import { api } from "@/lib/api";
import Link from "next/link";

export default async function ArtifactsPage() {
  let data: any = { artifacts: [], total: 0 };
  try { data = await api.controlPlane.artifacts.list({ limit: "100" }); } catch {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end"><div><div className="modern-label text-black/30">STORAGE • S3 • 06</div><h1 className="modern-display text-[32px] mt-2">ARTIFACTS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total||data.artifacts?.length||0} OBJECTS • S3 COMPATIBLE • CHECKSUM • RETENTION</div></div><Link href="/overview" className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">OVERVIEW →</Link></div>

      <div className="grid md:grid-cols-12 gap-4">
        {data.artifacts?.map((art:any)=>(
          <div key={art.id} className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between"><span className="modern-mono text-[11px] font-[600]">{(art.name||art.id.slice(0,12)).toUpperCase()}</span><span className="modern-mono text-[9px] bg-[#f5f5f5] px-2 py-1 rounded-full">{art.contentType}</span></div>
            <div className="mt-4 space-y-2">
              <div className="modern-mono text-[10px] text-black/40">ID: {art.id.slice(0,20)}...</div>
              <div className="modern-mono text-[10px] text-black/40">SIZE: {(art.size/1024).toFixed(1)}KB • {art.checksum?.slice(0,16)}...</div>
            </div>
            <div className="mt-4 flex gap-2">
              <a href={`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/artifacts/${art.id}`} target="_blank" className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">DOWNLOAD • S3</a>
              <a href={`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/artifacts/${art.id}/meta`} target="_blank" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">META</a>
              <span className="modern-mono text-[9px] border border-black/10 rounded-full px-2 py-1">{new Date(art.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
      {(!data.artifacts || data.artifacts.length===0) && <div className="rounded-[20px] border border-black/10 p-12 text-center modern-mono text-[11px] text-black/30">NO ARTIFACTS YET</div>}
    </div>
  );
}
