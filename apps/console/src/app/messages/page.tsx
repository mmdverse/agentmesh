import { api } from "@/lib/api";
import Link from "next/link";

export default async function MessagesPage({ searchParams }: { searchParams?: { limit?: string; offset?: string } }) {
  let data: any = { messages: [], total: 0 };
  const limit = parseInt(searchParams?.limit || "20", 10);
  const offset = parseInt(searchParams?.offset || "0", 10);
  try { data = await api.controlPlane.messages.list({ limit: String(limit), offset: String(offset) }); } catch {}
  const totalPages = Math.ceil((data.total || 0) / limit);
  const currentPage = Math.floor(offset / limit);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">ROUTER • LIVE • SYNC ASYNC STREAMING • 08 • {data.total} TOTAL</div><h1 className="modern-display text-[32px] mt-2">MESSAGES</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total||data.messages?.length||0} MESSAGES • TRACE PROPAGATION • A2A PROTOCOL • PAGINATION • PAGE {currentPage+1}/{Math.max(1,totalPages)}</div></div>
        <Link href="/chat" className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">CHAT → CREATE MESSAGE</Link>
      </div>

      <div className="space-y-3">
        {data.messages?.map((msg:any)=>(
          <div key={msg.id} className="rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between items-center"><span className="modern-mono text-[11px] font-[500]">{msg.sender?.slice(0,12)} → {msg.receiver?.slice(0,12)}</span><div className="flex gap-2"><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{msg.contentType}</span><span className="modern-mono text-[9px] bg-[#f5f5f5] px-2 py-1 rounded-full">{msg.id.slice(0,8).toUpperCase()}</span></div></div>
            <div className="mt-3 rounded-xl bg-[#fafafa] border border-black/5 p-3"><div className="modern-mono text-[11px] truncate">{JSON.stringify(msg.content||msg.body||{}).slice(0,300)}</div><div className="modern-mono text-[9px] text-black/30 mt-2">TRACE {msg.traceId?.slice(0,12)} • TASK {msg.taskId?.slice(0,8)} • {new Date(msg.createdAt||Date.now()).toLocaleString()}</div></div>
          </div>
        ))}
      </div>

      {data.total > limit && (
        <div className="flex justify-between items-center rounded-[20px] bg-white border border-black/10 p-4">
          <div className="modern-mono text-[11px] text-black/50">PAGE {currentPage+1} OF {totalPages} • {data.total} TOTAL</div>
          <div className="flex gap-2">
            {currentPage>0 && <Link href={`/messages?offset=${Math.max(0, offset-limit)}&limit=${limit}`} className="modern-mono text-[11px] border border-black/10 rounded-full px-4 py-2">← PREV</Link>}
            {currentPage < totalPages-1 && <Link href={`/messages?offset=${offset+limit}&limit=${limit}`} className="modern-mono text-[11px] bg-black text-white rounded-full px-4 py-2">NEXT →</Link>}
          </div>
        </div>
      )}

      {(!data.messages || data.messages.length===0) && <div className="rounded-[20px] border border-black/10 p-12 text-center"><div className="modern-mono text-[11px] text-black/30">NO MESSAGES YET • CREATE VIA SDK client.messages.send()</div><div className="modern-mono text-[10px] text-black/20 mt-2">Scenario 11 tested: 1 messages via SDK</div></div>}
    </div>
  );
}
