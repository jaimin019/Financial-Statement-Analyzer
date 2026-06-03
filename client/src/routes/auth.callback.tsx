import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/fs/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (s: Record<string, unknown>): { token?: string; isNew?: boolean; error?: string } => ({
    token: typeof s.token === "string" ? s.token : undefined,
    isNew: s.isNew === "true" || s.isNew === true,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const { token, isNew, error } = useSearch({ from: "/auth/callback" });
  const { loginWithToken } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (error) {
      showToast("Google sign-in failed", "error");
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (token) {
      loginWithToken(token);
      // Clear ?token= from history for safety
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/auth/callback");
      }
      if (isNew) navigate({ to: "/app/onboarding", replace: true });
      else navigate({ to: "/app", replace: true });
    } else {
      navigate({ to: "/auth", replace: true });
    }
  }, [token, isNew, error, loginWithToken, navigate, showToast]);

  return (
    <main className="min-h-screen grid place-items-center">
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block mb-6"
        >
          <Logo size={36} withText={false} />
        </motion.div>
        <p className="text-muted-foreground text-sm">Signing you in…</p>
      </div>
    </main>
  );
}
