import type { HTMLAttributes, ReactNode } from "react";
export function Card({ children, className = "", ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`bg-card border border-border rounded-2xl ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
      {...rest}
    >
      {children}
    </div>
  );
}
