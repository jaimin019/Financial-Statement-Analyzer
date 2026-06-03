import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/fs/Card";
import { Skeleton } from "@/components/fs/Skeleton";
import { Badge } from "@/components/fs/Badge";
import { analyticsApi, type SessionObj } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { isInvestmentType } from "@/lib/fileTypes";

interface Props {
  sessions: SessionObj[];
}

export function AnalyticsTab({ sessions }: Props) {
  const readySessions = sessions.filter(s => s.status === "ready");
  const [selectedId, setSelectedId] = useState(readySessions[0]?.sessionId || "");
  const session = readySessions.find(s => s.sessionId === selectedId);
  const [overview, setOverview] = useState<{ totalIncome: number; totalExpense: number; netFlow: number; transactionCount: number; avgMonthlySpend: number } | null>(null);
  const [categories, setCategories] = useState<{ category: string; totalSpent: number; percentOfTotal: number }[]>([]);
  const [months, setMonths] = useState<{ label: string; totalIncome: number; totalExpense: number }[]>([]);
  const [merchants, setMerchants] = useState<{ merchantName: string; totalSpent: number; transactionCount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!selectedId && readySessions[0]) setSelectedId(readySessions[0].sessionId); }, [readySessions, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancel = false;
    setLoading(true);
    Promise.all([
      analyticsApi.overview({ sessionId: selectedId }),
      analyticsApi.byCategory({ sessionId: selectedId }),
      analyticsApi.byMonth({ sessionId: selectedId }),
      analyticsApi.byMerchant({ sessionId: selectedId }),
    ]).then(([o, c, m, mer]) => {
      if (cancel) return;
      setOverview(o); setCategories(c.categories || []);
      setMonths(m.months || []); setMerchants(mer.merchants || []);
    }).catch(() => {/* per-section errors */})
    .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [selectedId]);

  if (readySessions.length === 0) {
    return <EmptyAnalytics />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Analyzing:</span>
        {readySessions.map(s => (
          <button
            key={s.sessionId}
            onClick={() => setSelectedId(s.sessionId)}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${
              selectedId === s.sessionId
                ? "bg-primary text-primary-foreground"
                : "bg-surface-elevated text-muted-foreground hover:text-foreground hover:bg-surface-overlay"
            }`}
          >
            {s.filename}
          </button>
        ))}
      </div>

      {loading || !overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Income" value={formatINR(overview.totalIncome)} tone="success" />
            <StatCard label="Expense" value={formatINR(overview.totalExpense)} tone="danger" />
            <StatCard label="Net flow" value={formatINR(overview.netFlow)} tone={overview.netFlow >= 0 ? "success" : "danger"} />
            <StatCard label="Transactions" value={overview.transactionCount.toLocaleString("en-IN")} tone="neutral" />
          </div>

          {session && isInvestmentType(session.fileType) ? (
            <Card className="p-6">
              <Badge tone="accent">Investments</Badge>
              <p className="mt-3 text-muted-foreground text-sm">Open the chat to query portfolio P&L and holdings.</p>
            </Card>
          ) : (
            <>
              <CategoryBreakdown categories={categories} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MonthlyTrend months={months} />
                <TopMerchants merchants={merchants} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "neutral" }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${c}`}>{value}</p>
      </Card>
    </motion.div>
  );
}

function CategoryBreakdown({ categories }: { categories: { category: string; totalSpent: number; percentOfTotal: number }[] }) {
  if (!categories.length) return null;
  const max = Math.max(...categories.map(c => c.totalSpent));
  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Spend by category</h3>
      <div className="space-y-3">
        {categories.slice(0, 8).map((c, i) => (
          <div key={c.category}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-foreground">{c.category}</span>
              <span className="font-mono text-muted-foreground">{formatINR(c.totalSpent)} · {c.percentOfTotal.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${(c.totalSpent / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MonthlyTrend({ months }: { months: { label: string; totalIncome: number; totalExpense: number }[] }) {
  if (!months.length) return null;
  const maxVal = Math.max(...months.flatMap(m => [m.totalIncome, m.totalExpense]));
  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Monthly flow</h3>
      <div className="flex items-end gap-2 h-48">
        {months.slice(-6).map((m, i) => (
          <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end h-full">
              <motion.div
                initial={{ height: 0 }} animate={{ height: `${(m.totalIncome / maxVal) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
                className="flex-1 rounded-t bg-success/60 min-h-[2px]"
              />
              <motion.div
                initial={{ height: 0 }} animate={{ height: `${(m.totalExpense / maxVal) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 + 0.05 }}
                className="flex-1 rounded-t bg-destructive/60 min-h-[2px]"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success/60" /> Income</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive/60" /> Expense</span>
      </div>
    </Card>
  );
}

function TopMerchants({ merchants }: { merchants: { merchantName: string; totalSpent: number; transactionCount: number }[] }) {
  if (!merchants.length) return null;
  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Top merchants</h3>
      <div className="space-y-2">
        {merchants.slice(0, 8).map((m, i) => (
          <motion.div
            key={m.merchantName}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-sm font-medium truncate">{m.merchantName}</p>
              <p className="text-xs text-muted-foreground">{m.transactionCount} txn{m.transactionCount === 1 ? "" : "s"}</p>
            </div>
            <span className="font-mono text-sm">{formatINR(m.totalSpent)}</span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function EmptyAnalytics() {
  return (
    <Card className="p-12 text-center">
      <div className="size-12 rounded-2xl bg-surface-overlay grid place-items-center mx-auto mb-4">
        <BarChart3 className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">No data to analyze yet</h3>
      <p className="text-sm text-muted-foreground mt-1">Upload a statement to see analytics here.</p>
    </Card>
  );
}
