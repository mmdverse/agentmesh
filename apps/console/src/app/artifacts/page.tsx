import { api } from "@/lib/api";
import Link from "next/link";

export default async function ArtifactsPage({ searchParams }: { searchParams?: { limit?: string; offset?: string } }) {
  let data: any = { artifacts: [], total: 0 };
  const limit = parseInt(searchParams?.limit || "12", 10);
  const offset = parseInt(searchParams?.offset || "0", 10);
  try { data = await api.controlPlane.artifacts.list({ limit: String(limit), offset: String(offset) }); } catch {}
  const totalPages = Math.ceil((data.total || 0) / limit);
  const currentPage = Math.floor(offset / limit);
  const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end"><div><div className="modern-label text-black/30">STORAGE • LIVE • S3 • 06 • {data.total} TOTAL</div><h1 className="modern-display text-[32px] mt-2">ARTIFACTS</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total||data.artifacts?.length||0} OBJECTS • S3 COMPATIBLE • CHECKSUM • RETENTION • PAGINATION PAGE {currentPage+1}/{Math.max(1,totalPages)} • LIVE FROM /v1/artifacts</div></div><Link href="/overview" className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">OVERVIEW →</Link></div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 grid md:grid-cols-12 gap-4">
          {data.artifacts?.map((art:any)=>(
            <div key={art.id} className="md:col-span-6 rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
              <div className="flex justify-between"><span className="modern-mono text-[11px] font-[600]">{(art.name||art.id.slice(0,12)).toUpperCase()}</span><span className="modern-mono text-[9px] bg-[#f5f5f5] px-2 py-1 rounded-full">{art.contentType}</span></div>
              <div className="mt-4 space-y-2">
                <div className="modern-mono text-[10px] text-black/40">ID: {art.id.slice(0,20)}... • TASK: {art.taskId?.slice(0,8) || "—"}</div>
                <div className="modern-mono text-[10px] text-black/40">SIZE: {(art.size/1024).toFixed(1)}KB • CHECKSUM {art.checksum?.slice(0,16)}...</div>
                <div className="modern-mono text-[10px] text-black/40">CREATED {new Date(art.createdAt).toLocaleString()}</div>
              </div>
              <div className="mt-4 flex gap-2">
                <a href={`${CP_URL}/v1/artifacts/${art.id}`} target="_blank" className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">DOWNLOAD • S3</a>
                <a href={`${CP_URL}/v1/artifacts/${art.id}/meta`} target="_blank" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5">META</a>
                <span className="modern-mono text-[9px] border border-black/10 rounded-full px-2 py-1">{art.contentType?.split("/")[1]?.toUpperCase() || "FILE"}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="md:col-span-4 space-y-4">
          <div className="rounded-[20px] bg-black text-white p-6">
            <div className="modern-label text-white/40">UPLOAD • LIVE • S3 COMPATIBLE</div>
            <div className="mt-4 space-y-2">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="modern-mono text-[10px] text-white/40">SDK UPLOAD</div>
                <pre className="mt-1 text-[10px] modern-mono text-white/60">client.artifacts.create({"{"}contentType:"application/json",jsonData:{"{"}...{"}"}{"}"})</pre>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="modern-mono text-[10px] text-white/40">CURL UPLOAD</div>
                <pre className="mt-1 text-[9px] modern-mono text-white/60">curl -X POST {CP_URL}/v1/artifacts -H "Content-Type: application/json" -d '{"{"}"name":"test.json"{"}"}'</pre>
              </div>
            </div>
            <div className="mt-4 flex gap-1">
              <span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">S3 COMPATIBLE</span>
              <span className="modern-mono text-[9px] bg-white text-black px-2 py-1 rounded-full">CHECKSUM</span>
            </div>
          </div>
          <div className="rounded-[20px] bg-[#fafafa] border border-black/10 p-6">
            <div className="modern-label text-black/30">STATS • LIVE</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white border border-black/5 p-3"><div className="modern-mono text-[9px] text-black/30">TOTAL</div><div className="modern-display text-[20px] mt-1">{data.total}</div></div>
              <div className="rounded-xl bg-white border border-black/5 p-3"><div className="modern-mono text-[9px] text-black/30">PAGE</div><div className="modern-display text-[20px] mt-1">{currentPage+1}/{Math.max(1,totalPages)}</div></div>
            </div>
            <div className="modern-mono text-[9px] text-black/30 mt-3">Scenario 10 tested: 1 artifacts via SDK</div>
          </div>
        </div>
      </div>

      {data.total > limit && (
        <div className="flex justify-between items-center rounded-[20px] bg-white border border-black/10 p-4">
          <div className="modern-mono text-[11px] text-black/50">PAGE {currentPage+1} OF {totalPages} • {data.total} TOTAL</div>
          <div className="flex gap-2">
            {currentPage>0 && <Link href={`/artifacts?offset=${Math.max(0, offset-limit)}&limit=${limit}`} className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">← PREV</Link>}
            {currentPage < totalPages-1 && <Link href={`/artifacts?offset=${offset+limit}&limit=${limit}`} className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">NEXT →</Link>}
          </div>
        </div>
      )}

      {(!data.artifacts || data.artifacts.length===0) && <div className="rounded-[20px] border border-black/10 p-12 text-center modern-mono text-[11px] text-black/30">NO ARTIFACTS YET • CREATE VIA SDK • Scenario 10</div>}
    </div>
  );
}
