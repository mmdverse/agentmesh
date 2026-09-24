import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "AgentMesh Console",
  description: "Infrastructure Gateway and Control Plane for AI Agents",
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/tasks", label: "Tasks" },
  { href: "/messages", label: "Messages" },
  { href: "/artifacts", label: "Artifacts" },
  { href: "/routes", label: "Routes" },
  { href: "/mcp", label: "MCP Bridge" },
  { href: "/policies", label: "Policies" },
  { href: "/organizations", label: "Organizations" },
  { href: "/telemetry", label: "Telemetry" },
  { href: "/health", label: "Health" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        <div className="flex min-h-screen">
          <aside className="w-64 border-r bg-card p-4 hidden md:block">
            <div className="mb-8">
              <h1 className="text-xl font-bold">AgentMesh</h1>
              <p className="text-xs text-muted-foreground">Infrastructure Gateway</p>
              <p className="text-[10px] text-muted-foreground mt-1">Made ❤️ by Mohammad @llllxyz</p>
            </div>
            <nav className="space-y-1">
              {nav.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded px-3 py-2 text-sm hover:bg-secondary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 p-3 rounded bg-secondary text-xs">
              <div className="font-semibold">Control Plane</div>
              <div className="text-muted-foreground">Registry, Policies, Identity</div>
              <div className="mt-2 font-semibold">Data Plane</div>
              <div className="text-muted-foreground">Gateway, Routing, Streaming</div>
            </div>
          </aside>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
