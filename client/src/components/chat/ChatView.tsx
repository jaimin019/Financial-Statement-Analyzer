import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Send, Sparkles, Quote, Loader2, Download, X } from "lucide-react";
import { Button } from "@/components/fs/Button";
import { Card } from "@/components/fs/Card";
import { Badge } from "@/components/fs/Badge";
import { Skeleton } from "@/components/fs/Skeleton";
import { useSSE } from "@/hooks/useSSE";
import { sessionApi, type SessionObj, type RawTransaction, type InsightObj, extractErrorMessage } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { FILE_TYPE_LABELS, getSuggestedQuestions } from "@/lib/fileTypes";
import { formatINR } from "@/lib/format";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citedRows: number[];
  sourceTransactions?: RawTransaction[];
  chart?: ChartData;
}

interface ChartData {
  type: "bar" | "line" | "pie";
  title: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  data: { label: string; value: number }[];
}

interface Props {
  session: SessionObj;
  onBack: () => void;
}

export function ChatView({ session, onBack }: Props) {
  const { sendMessage, isStreaming, cancel } = useSSE();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [statusText, setStatusText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [insights, setInsights] = useState<InsightObj | null>(session.insights);
  const [drawerRows, setDrawerRows] = useState<RawTransaction[] | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tokenBufferRef = useRef<string>("");
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await sessionApi.messages(session.sessionId);
        if (!cancelled) {
          setMessages(r.messages.map(m => ({ ...m, citedRows: m.citedRows || [] })));
        }
      } catch {/* ignore */}
      finally { if (!cancelled) setLoadingHistory(false); }
    })();
    return () => { cancelled = true; };
  }, [session.sessionId]);

  // Poll insights if not present
  useEffect(() => {
    if (insights) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await sessionApi.insights(session.sessionId);
        if (stopped) return;
        if (r.status === 200) {
          setInsights(r.data as InsightObj);
          return;
        }
        timer = setTimeout(tick, 3000);
      } catch {
        if (!stopped) timer = setTimeout(tick, 5000);
      }
    };
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [insights, session.sessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loadingHistory]);

  const handleSend = useCallback(async (question: string) => {
    if (!question.trim() || isStreaming) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: question, timestamp: new Date().toISOString(), citedRows: [] };
    const placeholder: ChatMessage = { role: "assistant", content: "", timestamp: new Date().toISOString(), citedRows: [] };
    setMessages((m) => [...m, userMsg, placeholder]);
    setStatusText("Searching your transactions…");
    tokenBufferRef.current = "";

    // Flush buffered tokens every 50ms
    flushIntervalRef.current = setInterval(() => {
      if (tokenBufferRef.current.length === 0) return;
      const buf = tokenBufferRef.current;
      tokenBufferRef.current = "";
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + buf };
        }
        return next;
      });
    }, 50);

    const recentHistory = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

    await sendMessage("/api/chat", {
      sessionId: session.sessionId,
      question,
      chatHistory: recentHistory,
    }, {
      onStatus: (msg) => setStatusText(msg),
      onToken: (token) => { tokenBufferRef.current += token; },
      onCitations: (data) => {
        const rows = (data.citedRowIndexes as number[]) || [];
        const sources = (data.sourceTransactions as RawTransaction[]) || [];
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, citedRows: rows, sourceTransactions: sources };
          }
          return next;
        });
      },
      onChart: (chartData) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, chart: chartData as ChartData };
          }
          return next;
        });
      },
      onDone: () => {
        if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
        // Final flush
        if (tokenBufferRef.current.length > 0) {
          const buf = tokenBufferRef.current;
          tokenBufferRef.current = "";
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + buf };
            }
            return next;
          });
        }
        setStatusText("");
      },
      onError: (msg) => {
        if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
        setStatusText("");
        showToast(msg, "error");
        setMessages((prev) => prev.slice(0, -1));
      },
    });
  }, [isStreaming, messages, sendMessage, session.sessionId, showToast]);

  const handleCitationClick = useCallback(async (msgIndex: number, rows: number[]) => {
    const msg = messages[msgIndex];
    if (msg.sourceTransactions && msg.sourceTransactions.length > 0) {
      setDrawerRows(msg.sourceTransactions);
      return;
    }
    setDrawerLoading(true); setDrawerRows([]);
    try {
      const r = await sessionApi.rows(session.sessionId, rows);
      // cache on message
      setMessages((prev) => {
        const next = [...prev];
        next[msgIndex] = { ...next[msgIndex], sourceTransactions: r };
        return next;
      });
      setDrawerRows(r);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
      setDrawerRows(null);
    } finally { setDrawerLoading(false); }
  }, [messages, session.sessionId, showToast]);

  const handleExport = async () => {
    try {
      const blob = await sessionApi.generateReport(session.sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-report-${session.sessionId.slice(0,8)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Report downloaded", "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const showInsightLanding = messages.length === 0 && !loadingHistory;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Sub-header */}
      <div className="border-b border-border px-4 sm:px-6 py-3 flex items-center gap-3 bg-surface/40">
        <button onClick={onBack} className="size-9 grid place-items-center rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-medium truncate">{session.filename}</h2>
            <Badge tone="default">{FILE_TYPE_LABELS[session.fileType] || session.fileType}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{session.rowCount.toLocaleString("en-IN")} transactions analyzed</p>
        </div>
        <Button size="sm" variant="outline" iconLeft={<Download className="size-4" />} onClick={handleExport}>
          <span className="hidden sm:inline">Export PDF</span>
        </Button>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
          {loadingHistory ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-3/4 ml-auto" />
            </div>
          ) : showInsightLanding ? (
            <InsightLanding session={session} insights={insights} onAsk={handleSend} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  isLast={i === messages.length - 1}
                  isStreaming={isStreaming && i === messages.length - 1 && m.role === "assistant"}
                  onCitationClick={() => handleCitationClick(i, m.citedRows)}
                />
              ))}
            </AnimatePresence>
          )}
          {isStreaming && statusText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-muted-foreground mt-2 ml-10">
              <Loader2 className="size-3 animate-spin" /> {statusText}
            </motion.div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-surface/40 px-4 sm:px-6 py-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="mx-auto max-w-3xl flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Ask a question about your transactions…"
            rows={1}
            className="flex-1 min-h-[48px] max-h-32 resize-none px-4 py-3 rounded-xl bg-input border border-border-strong focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring text-sm"
          />
          {isStreaming ? (
            <Button type="button" variant="outline" onClick={cancel} iconLeft={<X className="size-4" />}>Stop</Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} iconRight={<Send className="size-4" />}>Send</Button>
          )}
        </form>
      </div>

      {/* Source drawer */}
      <SourceDrawer rows={drawerRows} loading={drawerLoading} onClose={() => setDrawerRows(null)} />
    </div>
  );
}

function MessageBubble({ message, isStreaming, onCitationClick }: {
  message: ChatMessage; isLast: boolean; isStreaming: boolean; onCitationClick: () => void;
}) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 mb-6 justify-end"
      >
        <div className="bg-surface-elevated rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[85%] text-foreground">
          {message.content}
        </div>
        <div className="size-8 rounded-full bg-surface-elevated grid place-items-center text-xs text-muted-foreground shrink-0">You</div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 mb-6">
      <div className="size-8 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
        <Sparkles className="size-4 text-background" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-foreground leading-relaxed prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <ReactMarkdown>{message.content || (isStreaming ? "…" : "")}</ReactMarkdown>
        </div>
        {message.chart && <ChartRenderer chart={message.chart} />}
        {message.citedRows.length > 0 && (
          <button
            onClick={onCitationClick}
            className="mt-3 flex flex-wrap gap-1.5 cursor-pointer"
          >
            {message.citedRows.slice(0, 12).map((r) => (
              <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-[11px] font-mono transition">
                <Quote className="size-2.5" /> Row {r}
              </span>
            ))}
            {message.citedRows.length > 12 && (
              <span className="text-[11px] text-muted-foreground pl-1 pt-0.5">+{message.citedRows.length - 12} more</span>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ChartRenderer({ chart }: { chart: ChartData }) {
  const max = Math.max(...chart.data.map(d => d.value)) || 1;
  return (
    <Card className="p-5 mt-4">
      <h4 className="text-sm font-semibold mb-4">{chart.title}</h4>
      <div className="space-y-2.5">
        {chart.data.slice(0, 10).map((d, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground truncate pr-2">{d.label}</span>
              <span className="font-mono">{formatINR(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.05 }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightLanding({ session, insights, onAsk }: {
  session: SessionObj; insights: InsightObj | null; onAsk: (q: string) => void;
}) {
  const suggestions = getSuggestedQuestions(session.fileType);
  return (
    <div className="space-y-6 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Badge tone="primary"><Sparkles className="size-3" /> AI Summary</Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Your statement, at a glance</h2>
      </motion.div>

      {insights ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="p-5">
            <p className="text-foreground leading-relaxed">{insights.summary}</p>
          </Card>
        </motion.div>
      ) : (
        <Skeleton className="h-24" />
      )}

      {insights && (
        <motion.div
          initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <StatTile label="Income" value={formatINR(insights.incomeVsExpense.totalIncome)} tone="success" />
          <StatTile label="Expense" value={formatINR(insights.incomeVsExpense.totalExpense)} tone="danger" />
          <StatTile label="Net flow" value={formatINR(insights.incomeVsExpense.netFlow)} tone={insights.incomeVsExpense.netFlow >= 0 ? "success" : "danger"} />
        </motion.div>
      )}

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Try asking</h3>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              onClick={() => onAsk(q)}
              className="px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-overlay border border-border-strong text-sm text-foreground transition text-left"
            >
              {q}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${tone === "success" ? "text-success" : "text-destructive"}`}>{value}</p>
      </Card>
    </motion.div>
  );
}

function SourceDrawer({ rows, loading, onClose }: { rows: RawTransaction[] | null; loading: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {rows !== null && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 240, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] glass-strong border-l border-border z-50 overflow-y-auto"
          >
            <div className="sticky top-0 z-10 glass-strong border-b border-border px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Source transactions</h3>
                <p className="text-xs text-muted-foreground">{rows?.length || 0} row{rows?.length === 1 ? "" : "s"} cited</p>
              </div>
              <button onClick={onClose} className="size-8 grid place-items-center rounded-lg hover:bg-surface-elevated">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
                </>
              ) : rows && rows.length > 0 ? rows.map((r) => (
                <motion.div
                  key={r.rowIndex}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{r.merchantName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{r.category} · {r.normalizedDate}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono font-semibold ${r.direction === "credit" || r.direction === "sell" ? "text-success" : "text-destructive"}`}>
                          {r.direction === "credit" || r.direction === "sell" ? "+" : "−"}
                          {formatINR(Math.abs(r.normalizedAmount)).replace("−", "").replace("+", "")}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">Row {r.rowIndex}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions to show</p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
