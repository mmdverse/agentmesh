"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-8">
      <div className="rounded-[24px] bg-black text-white p-8">
        <div className="modern-label text-white/40">ERROR • LIVE • RETRY</div>
        <h1 className="modern-display text-[24px] mt-3">SOMETHING WENT WRONG</h1>
        <div className="modern-mono text-[11px] text-white/50 mt-2">Control Plane may be down • InMemory fallback active • Check CP 3002</div>
        <pre className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 text-[10px] modern-mono text-white/60 overflow-auto max-h-40">{error.message.slice(0,1000)}</pre>
        <div className="mt-6 flex gap-2">
          <button onClick={reset} className="modern-mono text-[11px] bg-white text-black rounded-full px-5 py-2.5">RETRY →</button>
          <a href="/overview" className="modern-mono text-[11px] border border-white/15 rounded-full px-5 py-2.5">OVERVIEW →</a>
        </div>
      </div>
      <div className="rounded-[20px] bg-[#fffbeb] border border-amber-200 p-6">
        <div className="modern-label text-black/30">TROUBLESHOOTING</div>
        <div className="mt-3 space-y-2 modern-mono text-[11px] text-black/60">
          <div>• Check CP health: curl http://localhost:3002/health</div>
          <div>• Check Gateway: curl http://localhost:3001/health</div>
          <div>• Real agent 9001: curl http://localhost:9001/health</div>
          <div>• InMemory mode: data lost on restart, use docker-compose up for persistence</div>
          <div>• Build: pnpm exec tsc -b --force, then pnpm --filter console build</div>
        </div>
      </div>
    </div>
  );
}
