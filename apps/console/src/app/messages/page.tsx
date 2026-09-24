import { api } from "@/lib/api";

export default async function MessagesPage() {
  let data: any = { messages: [], total: 0 };
  try { data = await api.controlPlane.messages.list({ limit: "100" }); } catch {}

  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">ROUTER • SYNC ASYNC STREAMING • 08</div><h1 className="modern-display text-[32px] mt-2">MESSAGES</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.total||data.messages?.length||0} MESSAGES • TRACE PROPAGATION • A2A PROTOCOL</div></div>

      <div className="space-y-3">
        {data.messages?.map((msg:any)=>(
          <div key={msg.id} className="rounded-[20px] bg-white border border-black/10 p-6 modern-hover">
            <div className="flex justify-between items-center"><span className="modern-mono text-[11px] font-[500]">{msg.sender} → {msg.receiver}</span><span className="modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">{msg.contentType}</span></div>
            <div className="mt-3 rounded-xl bg-[#fafafa] border border-black/5 p-3"><div className="modern-mono text-[11px] truncate">{JSON.stringify(msg.content||msg.body||{}).slice(0,300)}</div><div className="modern-mono text-[9px] text-black/30 mt-2">{msg.traceId?.slice(0,12)} • {new Date(msg.createdAt||Date.now()).toLocaleTimeString()}</div></div>
          </div>
        ))}
      </div>
      {(!data.messages || data.messages.length===0) && <div className="rounded-[20px] border border-black/10 p-12 text-center modern-mono text-[11px] text-black/30">NO MESSAGES YET</div>}
    </div>
  );
}
