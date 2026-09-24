import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "black" | "white";
}) {
  const variant = (props as any).variant ?? "default";
  const variants: Record<string, string> = {
    default: "bg-black text-white border-black",
    secondary: "bg-[#f5f5f5] text-black border-black/[0.06]",
    destructive: "bg-black text-white",
    outline: "border-black/10 text-black bg-white hover:bg-black hover:text-white transition-colors",
    black: "bg-black text-white border-white/10",
    white: "bg-white text-black border-black/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-[500] modern-mono tracking-[0.04em]",
        "border",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function ModernBadge({ children, className, variant = "live" }: { children: React.ReactNode; className?: string; variant?: "live" | "dot" | "count" }) {
  const variants = {
    live: "bg-black text-white",
    dot: "bg-white border border-black/10 text-black",
    count: "bg-[#f5f5f5] text-black/60",
  };
  
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] modern-mono", variants[variant], className)}>
      {children}
    </span>
  );
}
