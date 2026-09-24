import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "AgentMesh — Modern Luxury Minimal",
  description: "Black Gray White Gradient • Modern Luxury • Minimal",
};

const nav = [
  { href: "/", label: "Landing", mono: "00" },
  { href: "/overview", label: "Overview", mono: "01", live: true },
  { href: "/chat", label: "Chat", mono: "02", new: true },
  { href: "/agents", label: "Agents", mono: "03", count: "1" },
  { href: "/tasks", label: "Tasks", mono: "04", live: true },
  { href: "/messages", label: "Messages", mono: "05" },
  { href: "/artifacts", label: "Artifacts", mono: "06" },
  { href: "/routes", label: "Routes", mono: "07" },
  { href: "/mcp", label: "MCP", mono: "08" },
  { href: "/telemetry", label: "Telemetry", mono: "09" },
  { href: "/health", label: "Health", mono: "10" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar — Modern White with hairline */}
          <aside className="w-[300px] hidden md:flex flex-col border-r border-black/[0.06] bg-white relative">
            <div className="absolute inset-0 modern-gradient-mesh pointer-events-none opacity-[0.5]" />
            
            <div className="relative p-8 flex flex-col h-full">
              <div className="space-y-6">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="modern-display text-[24px]">AGENT<br/>MESH</div>
                    <div className="w-2 h-2 bg-black rounded-full animate-pulse mt-1" />
                  </div>
                  <div className="modern-label text-black/40 mt-3">INFRASTRUCTURE GATEWAY / 1.0.0</div>
                  <div className="mt-4 h-px bg-black/10" />
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="modern-label text-black/30 mb-3">NAVIGATION</div>
                    <nav className="space-y-1">
                      {nav.map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`group flex items-center justify-between py-2.5 px-3 -mx-3 rounded-xl text-[13px] modern-hover ${
                            item.new
                              ? "bg-black text-white font-[600]"
                              : "text-black/60 hover:text-black hover:bg-black/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="modern-mono text-[10px] w-6 opacity-40 group-hover:opacity-100">{item.mono}</span>
                            <span className="tracking-[-0.01em]">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.live && <span className="w-1 h-1 bg-black rounded-full animate-pulse" />}
                            {item.new && <span className="modern-label text-[8px] bg-white text-black px-1.5 py-0.5 rounded">NEW</span>}
                            {item.count && <span className="modern-mono text-[10px] bg-black/5 px-1.5 py-0.5 rounded">{item.count}</span>}
                          </div>
                        </Link>
                      ))}
                    </nav>
                  </div>

                  <div>
                    <div className="modern-label text-black/30 mb-3">SYSTEM</div>
                    <div className="space-y-2.5">
                      {[
                        { name: "CONTROL PLANE", port: "3002", status: "LIVE", color: "bg-black" },
                        { name: "GATEWAY", port: "3001", status: "LIVE", color: "bg-black" },
                        { name: "REAL AGENT", port: "9001", status: "REAL", color: "bg-black/60" },
                      ].map(s => (
                        <div key={s.name} className="flex items-center justify-between py-2 border-b border-black/[0.04] last:border-0">
                          <div>
                            <div className="modern-mono text-[11px] font-[500] tracking-[-0.01em]">{s.name}</div>
                            <div className="modern-mono text-[10px] text-black/40">{s.port}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1 h-1 rounded-full ${s.color}`} />
                            <span className="modern-label text-[9px]">{s.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-4">
                <div className="rounded-2xl bg-black text-white p-4">
                  <div className="modern-label text-white/50 text-[10px]">OPEN SOURCE</div>
                  <div className="text-[12px] leading-[1.4] mt-2 tracking-[-0.01em]">Free for personal & commercial. No license. Donate crypto.</div>
                  <div className="mt-3 flex gap-1">
                    <span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">BTC</span>
                    <span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">SOL</span>
                    <span className="modern-mono text-[9px] bg-white/10 px-2 py-1 rounded-full">BNB</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-black/10">
                  <span className="modern-mono text-[10px] text-black/30">© 2026</span>
                  <a href="https://github.com/mmdverse/AgentMesh" className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1 hover:bg-black hover:text-white transition-colors">GITHUB →</a>
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 overflow-auto bg-[#fbfbfb] relative">
            <div className="absolute inset-0 bg-gradient-to-b from-white via-[#fcfcfc] to-[#f9f9f9] pointer-events-none" />
            <div className="relative">
              <div className="sticky top-0 z-10 bg-[#fffbeb] border-b border-black/5 px-10 py-2.5 flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                <span className="modern-mono text-[10px] tracking-[0.04em] text-black/70">INMEMORY MODE — DATA WILL BE LOST ON RESTART • USE docker-compose up FOR PERSISTENCE • POSTGRES REDIS NATS MINIO</span>
                <span className="ml-auto modern-mono text-[9px] bg-black text-white px-2 py-1 rounded-full">DEV</span>
              </div>
              <div className="p-10 max-w-[1400px] mx-auto">{children}</div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
