import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppNav } from "@/components/app/AppNav";
import { Card } from "@/components/fs/Card";
import { Badge } from "@/components/fs/Badge";
import { Button } from "@/components/fs/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
});

const GUIDES = [
  {
    brand: "Zerodha",
    color: "oklch(0.78 0.16 220)",
    items: [
      { title: "Tradebook", steps: ["Go to console.zerodha.com", "Reports → Tradebook", "Select date range", "Download as CSV"], asks: ["Which symbol made me the most money?", "How many trades did I make this month?"] },
      { title: "P&L Report", steps: ["Console → Reports → P&L", "Pick segment (Equity / F&O / Currency)", "Download as CSV"], asks: ["What is my total realized P&L?", "Show me my biggest losing trade"] },
      { title: "Ledger", steps: ["Console → Funds → Statement", "Pick date range", "Download as CSV"], asks: ["What were my total brokerage charges?", "Show me all fund withdrawals"] },
      { title: "Holdings", steps: ["Console → Portfolio → Holdings", "Click Export → CSV"], asks: ["Which stocks are in profit?", "What is my portfolio allocation?"] },
    ],
  },
  {
    brand: "Groww",
    color: "oklch(0.84 0.14 88)",
    items: [
      { title: "Stocks Report", steps: ["Open Groww app → Profile", "Reports → Stocks", "Email yourself the CSV"], asks: ["Which stocks did I trade most?", "What is my total realized P&L?"] },
      { title: "Mutual Funds", steps: ["Profile → Reports → Mutual Funds", "Email yourself the CSV"], asks: ["Which funds did I SIP into?", "Show all redemptions"] },
      { title: "Holdings Snapshot", steps: ["Profile → Reports → Holdings", "Download CSV"], asks: ["Which fund is performing best?", "Show losing positions"] },
    ],
  },
];

function IntegrationsPage() {
  const { isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isAuthenticated) navigate({ to: "/auth", replace: true });
  }, [isReady, isAuthenticated, navigate]);

  if (!isReady || !isAuthenticated) return null;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <button onClick={() => router.history.back()} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-6">
          <ArrowLeft className="size-4" /> Back
        </button>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-semibold tracking-tight">Download your broker data</h1>
          <p className="mt-3 text-muted-foreground text-lg">
            Step-by-step guides for getting export-ready files from each platform.
          </p>
        </motion.div>

        <div className="mt-10 space-y-10">
          {GUIDES.map((guide, gi) => (
            <motion.section key={guide.brand}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: gi * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="size-3 rounded-full" style={{ background: guide.color }} />
                <h2 className="text-2xl font-semibold">{guide.brand}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {guide.items.map((item, i) => (
                  <motion.div key={item.title}
                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="p-5 h-full">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{item.title}</h3>
                        <Badge tone="default">CSV</Badge>
                      </div>
                      <ol className="space-y-1.5 text-sm text-muted-foreground">
                        {item.steps.map((s, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-primary font-mono shrink-0">{j + 1}.</span><span>{s}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="mt-4 pt-3 border-t border-border">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Ask after uploading</p>
                        <ul className="space-y-1">
                          {item.asks.map(a => (
                            <li key={a} className="text-xs text-foreground italic">"{a}"</li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button onClick={() => navigate({ to: "/app" })} iconRight={<ExternalLink className="size-4" />}>
            Back to your statements
          </Button>
        </div>
      </main>
    </div>
  );
}
