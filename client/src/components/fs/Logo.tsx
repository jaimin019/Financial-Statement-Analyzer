import { motion, useReducedMotion } from "framer-motion";

export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-2.5">
      <motion.div
        initial={reduce ? false : { rotate: -20, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        className="relative grid place-items-center rounded-xl"
        style={{
          width: size, height: size,
          background: "var(--gradient-primary)",
          boxShadow: "0 6px 20px -6px oklch(0.82 0.17 165 / 0.6)",
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="oklch(0.15 0.02 250)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17 L9 11 L13 14 L21 6" />
          <path d="M14 6 L21 6 L21 13" />
        </svg>
      </motion.div>
      {withText && (
        <div className="flex items-baseline gap-1 leading-none">
          <span className="font-semibold text-foreground tracking-tight text-[17px]">FinSight</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">AI</span>
        </div>
      )}
    </div>
  );
}
