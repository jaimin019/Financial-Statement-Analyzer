import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_8px_28px_-8px_oklch(0.82_0.17_165_/_0.45)]",
  secondary:
    "bg-surface-elevated text-foreground border border-border-strong hover:bg-surface-overlay",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-elevated",
  outline:
    "border border-border-strong text-foreground hover:bg-surface-elevated bg-transparent",
  destructive:
    "bg-destructive text-destructive-foreground hover:brightness-110",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-base rounded-xl gap-2",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, iconLeft, iconRight, children, className = "", fullWidth, disabled, ...rest },
  ref
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      whileHover={reduce ? undefined : { scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`inline-flex items-center justify-center font-medium tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...(rest as any)}
    >
      {loading ? (
        <span className="inline-block size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : iconLeft}
      {children}
      {!loading && iconRight}
    </motion.button>
  );
});
