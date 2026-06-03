import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, Sparkles } from "lucide-react";
import { Logo } from "@/components/fs/Logo";
import { Button } from "@/components/fs/Button";
import { Input } from "@/components/fs/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { extractErrorMessage, startGoogleOAuth } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { error?: string; mode?: "login" | "register" } => ({
    error: typeof s.error === "string" ? s.error : undefined,
    mode: s.mode === "register" ? "register" : "login",
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isReady, login, register } = useAuth();
  const { showToast } = useToast();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "register">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate({ to: "/app", replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  useEffect(() => {
    if (search.error === "google_failed") {
      showToast("Google sign-in failed. Please try again.", "error");
    }
  }, [search.error, showToast]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 8 || !/\d/.test(password)) {
      return showToast("Please enter a valid email and 8+ character password with at least one number", "error");
    }
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      showToast(mode === "login" ? "Welcome back" : "Account created", "success");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" aria-hidden />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} aria-hidden />

      <div className="absolute top-6 left-6">
        <Link to="/"><Logo /></Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -inset-6 -z-10 rounded-[2rem]" style={{ background: "var(--gradient-glow)", opacity: 0.4 }} />
        <div className="glass-strong rounded-3xl p-8 shadow-elevated" style={{ boxShadow: "var(--shadow-elevated)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-3xl font-semibold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mode === "login" ? "Sign in to your FinSight workspace" : "Start asking your statements anything"}
              </p>
            </motion.div>
          </AnimatePresence>

          <button
            type="button" onClick={startGoogleOAuth}
            className="mt-7 w-full h-12 rounded-xl bg-surface-elevated border border-border-strong hover:bg-surface-overlay transition flex items-center justify-center gap-3 text-sm font-medium text-foreground"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3.5 top-9 size-4 text-muted-foreground pointer-events-none" />
              <Input
                label="Email" type="email" required autoComplete="email"
                placeholder="you@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-9 size-4 text-muted-foreground pointer-events-none" />
              <Input
                label="Password" type="password" required minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                hint={mode === "register" ? "Minimum 8 characters, at least one number" : undefined}
              />
            </div>

            <Button type="submit" fullWidth size="lg" loading={submitting} iconRight={<ArrowRight className="size-5" />}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary hover:underline font-medium"
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Sparkles className="size-3 text-primary" /> We never share your data with anyone.
        </p>
      </motion.div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#FFC107" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5c-.2 1.3-1 2.4-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5z"/>
      <path fill="#FF3D00" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6C4.7 19.7 8.1 22 12 22z"/>
      <path fill="#4CAF50" d="M6.4 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H3C2.4 9 2 10.5 2 12s.4 3 1 4.4l3.4-2.6z"/>
      <path fill="#1976D2" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 3 14.7 2 12 2 8.1 2 4.7 4.3 3 7.6L6.4 10.2C7.2 7.8 9.4 6 12 6z"/>
    </svg>
  );
}
