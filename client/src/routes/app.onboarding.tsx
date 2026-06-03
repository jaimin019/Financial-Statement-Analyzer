import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Upload, MessageSquare, SkipForward } from "lucide-react";
import { Button } from "@/components/fs/Button";
import { Logo } from "@/components/fs/Logo";
import { Card } from "@/components/fs/Card";
import { UploadDropzone } from "@/components/app/UploadDropzone";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/app/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isReady && !isAuthenticated) navigate({ to: "/auth", replace: true });
  }, [isReady, isAuthenticated, navigate]);

  const finish = () => navigate({ to: "/app", replace: true });

  return (
    <main className="min-h-screen grid place-items-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" aria-hidden />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} aria-hidden />

      <div className="absolute top-6 left-6"><Logo /></div>
      <button
        onClick={finish}
        className="absolute top-6 right-6 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
      >
        Skip <SkipForward className="size-4" />
      </button>

      <div className="relative w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="0"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="inline-grid place-items-center size-20 rounded-3xl mb-6 pulse-glow"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Sparkles className="size-8 text-background" />
              </motion.div>
              <h1 className="text-5xl font-semibold tracking-tight">Welcome to FinSight</h1>
              <p className="mt-4 text-lg text-muted-foreground">Let's set up your first analysis in 60 seconds.</p>
              <Button size="lg" className="mt-8" iconRight={<ArrowRight className="size-5" />} onClick={() => setStep(1)}>
                Get started
              </Button>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="1"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            >
              <Card className="p-7">
                <div className="flex items-center gap-3 mb-5">
                  <div className="size-10 rounded-xl grid place-items-center" style={{ background: "oklch(0.82 0.17 165 / 0.15)" }}>
                    <Upload className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Upload your first statement</h2>
                    <p className="text-sm text-muted-foreground">CSV or PDF — we handle the rest.</p>
                  </div>
                </div>
                <UploadDropzone onUploaded={() => setStep(2)} />
                <div className="mt-5 flex justify-end">
                  <Button variant="ghost" onClick={() => setStep(2)}>I'll do this later</Button>
                </div>
              </Card>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="2"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="text-center"
            >
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="inline-grid place-items-center size-20 rounded-3xl mb-6"
                style={{ background: "oklch(0.82 0.17 165 / 0.15)" }}
              >
                <MessageSquare className="size-8 text-primary" />
              </motion.div>
              <h1 className="text-4xl font-semibold tracking-tight">You're all set</h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-md mx-auto">
                Open your statement, ask anything. Every answer cites the exact rows.
              </p>
              <Button size="lg" className="mt-8" iconRight={<ArrowRight className="size-5" />} onClick={finish}>
                Enter FinSight
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 flex justify-center gap-2">
          {[0,1,2].map(i => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-1.5 bg-border-strong"}`} />
          ))}
        </div>
      </div>
    </main>
  );
}
