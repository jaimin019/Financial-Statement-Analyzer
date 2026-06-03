import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className = "", id, ...rest }, ref
) {
  const inputId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`h-11 px-4 rounded-xl bg-input border border-border-strong text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring transition-all ${error ? "border-destructive focus:border-destructive focus:ring-destructive/30" : ""} ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
});
