import type { ReactNode } from "react";
export function Badge({ children, tone = "default", className = "" }: {
  children: ReactNode; tone?: "default" | "primary" | "success" | "danger" | "warning" | "accent"; className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-surface-overlay text-muted-foreground border-border",
    primary: "bg-primary/15 text-primary border-primary/30",
    success: "bg-success/15 text-success border-success/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    accent: "bg-accent/15 text-accent border-accent/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium uppercase tracking-wider ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
