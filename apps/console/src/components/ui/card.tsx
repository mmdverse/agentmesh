import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white modern-border modern-shadow modern-hover",
        "border-black/[0.06]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1 p-7", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[13px] font-[600] tracking-[-0.02em] leading-none",
        "modern-mono",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[11px] text-black/50 modern-mono tracking-[0.02em]", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-7 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-7 pt-0", className)} {...props} />;
}

// Modern variants
export function ModernCard({ className, variant = "white", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "white" | "black" | "gray" | "glass" }) {
  const variants = {
    white: "bg-white modern-border modern-shadow",
    black: "bg-black text-white modern-border-white",
    gray: "modern-gradient-gray modern-border",
    glass: "modern-glass modern-shadow",
  };
  
  return (
    <div
      className={cn(
        "rounded-2xl modern-hover",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
