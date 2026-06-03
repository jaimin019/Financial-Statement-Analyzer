import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  Sparkles, FileText, Quote, ShieldCheck, BarChart3, MessageSquare,
  ArrowRight, CheckCircle2, Zap, Brain, Lock, ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/fs/Logo";
import { Button } from "@/components/fs/Button";
import { Card } from "@/components/fs/Card";
import { Badge } from "@/components/fs/Badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { authApi, extractErrorMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FinSight AI — Ask your bank statements anything" },
      { name: "description", content: "Upload statements from HDFC, ICICI, SBI, Zerodha, Groww. Ask questions in plain English. Every answer cites the exact transactions." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen text-foreground">
      <Nav />
      <Hero />
      <LogoStrip />
      <Features />
      <DemoPreview />
      <HowItWorks />
      <Waitlist />
      <Footer />
    </main>
  );
}

function Nav() {
  const { isAuthenticated } = useAuth();
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4">
        <motion.nav
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="glass-strong flex items-center justify-between rounded-2xl pl-4 pr-2 py-2 sm:pl-5 sm:pr-3 sm:py-2.5"
        >
          <Link to="/" className="shrink-0"><Logo /></Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#demo" className="hover:text-foreground transition">Demo</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
            <a href="#waitlist" className="hover:text-foreground transition">Waitlist</a>
          </div>
          {isAuthenticated ? (
            <Link to="/app"><Button size="sm" iconRight={<ArrowRight className="size-4" />}>Go to app</Button></Link>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link to="/auth"><Button size="sm" variant="ghost">Sign in</Button></Link>
              <Link to="/auth"><Button size="sm" iconRight={<ArrowRight className="size-4" />}>Get started</Button></Link>
            </div>
          )}
        </motion.nav>
      </div>
    </header>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : -80]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.4]);

  return (
    <section className="relative pt-36 sm:pt-44 pb-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none" aria-hidden />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--gradient-hero)" }}
        aria-hidden
      />
      <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative mx-auto max-w-5xl px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-7"
        >
          <Sparkles className="size-3.5" /> Built for Indian investors
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 80, damping: 20 }}
          className="text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
        >
          Ask your{" "}
          <span className="text-gradient-primary">bank statements</span>
          <br className="hidden sm:block" /> anything.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Upload statements from HDFC, ICICI, SBI, Axis, Zerodha or Groww. Get answers in plain English — every one cites the exact transactions as proof.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link to="/auth"><Button size="lg" iconRight={<ArrowRight className="size-5" />}>Start free</Button></Link>
          <a href="#demo">
            <Button size="lg" variant="outline" iconLeft={<MessageSquare className="size-4" />}>See it in action</Button>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5"><Lock className="size-3.5 text-success" /> End-to-end encrypted</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-success" /> Your data, your control</span>
          <span className="flex items-center gap-1.5"><Zap className="size-3.5 text-warning" /> Sub-second answers</span>
        </motion.div>

        <HeroPreview />
      </motion.div>
      <ScrollHint />
    </section>
  );
}

function HeroPreview() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 60, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 60, damping: 20 }}
      style={{ transformPerspective: 1400 }}
      className="mt-16 sm:mt-24 mx-auto max-w-4xl text-left relative"
    >
      <div className="absolute -inset-8 -z-10 rounded-[2rem]" style={{ background: "var(--gradient-glow)", opacity: 0.5 }} />
      <Card className="overflow-hidden glass-strong">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/60" />
          </div>
          <span className="ml-3 text-xs text-muted-foreground font-mono">finsight.ai / hdfc-aug-2024.csv</span>
        </div>
        <div className="p-5 sm:p-7 space-y-5">
          <div className="flex items-start gap-3">
            <div className="size-7 rounded-full bg-surface-elevated grid place-items-center text-xs text-muted-foreground">You</div>
            <div className="text-sm sm:text-base text-foreground leading-relaxed pt-0.5">
              How much did I spend on Swiggy last month?
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-7 rounded-xl grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="size-3.5 text-background" />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm sm:text-base leading-relaxed">
                You spent <span className="text-primary font-semibold">{formatINR(8420)}</span> on Swiggy across <span className="font-semibold">14 orders</span> in August. Your average order was {formatINR(601)}, with the largest being {formatINR(1240)} on Aug 18.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[14, 28, 47, 59, 73, 88, 102, 119, 134, 156].map((r) => (
                  <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-[11px] font-mono">
                    <Quote className="size-2.5" /> Row {r}
                  </span>
                ))}
                <span className="text-[11px] text-muted-foreground pl-1 pt-0.5">+4 more</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ScrollHint() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: 1.2 }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center text-muted-foreground text-xs gap-1.5"
    >
      <span>Scroll</span>
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
        <ChevronDown className="size-4" />
      </motion.div>
    </motion.div>
  );
}

const BANKS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "Zerodha", "Groww"];

function LogoStrip() {
  return (
    <section className="py-12 border-y border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs text-center text-muted-foreground uppercase tracking-[0.18em] mb-6">
          Built to read statements from
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {BANKS.map((b, i) => (
            <motion.span
              key={b}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 0.7, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="text-lg sm:text-xl font-semibold tracking-tight text-foreground/60"
            >
              {b}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: FileText, title: "Drop in any statement", desc: "CSV or PDF from your bank or broker. We parse it instantly — no manual cleanup, no templates." },
  { icon: Brain, title: "Ask in plain English", desc: '"How much did I spend on Swiggy?" or "What is my realized P&L?" — the AI understands intent, not just keywords.' },
  { icon: Quote, title: "Every answer is cited", desc: "Every claim links to the exact source rows. Click to see the underlying transactions. Trust, verified." },
  { icon: BarChart3, title: "Visualize on demand", desc: "Charts generate automatically when the question calls for one. Spend by category, P&L by symbol, month-over-month." },
  { icon: ShieldCheck, title: "Private by design", desc: "Your data lives in your workspace. No third-party tracking, no model fine-tuning on your statements. Ever." },
  { icon: Zap, title: "Built for Indian investors", desc: "Speaks Zerodha. Speaks Groww. Speaks ₹. Indian formatting, Indian tax categories, Indian holidays." },
];

function Features() {
  return (
    <section id="features" className="py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="Why FinSight"
          title="A spreadsheet can't answer questions. We can."
          subtitle="The intelligence layer your bank statements have been missing."
        />
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 100, damping: 20 }}
            >
              <Card className="p-6 h-full hover:border-primary/40 transition-colors group">
                <div
                  className="size-11 rounded-xl grid place-items-center mb-5 group-hover:scale-110 transition-transform"
                  style={{ background: "oklch(0.82 0.17 165 / 0.12)" }}
                >
                  <f.icon className="size-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoPreview() {
  return (
    <section id="demo" className="py-28 sm:py-36 relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="See it" title="One question. One source of truth." subtitle="Every answer comes with receipts. Click any citation to see the underlying row." />
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <ChatPreviewCard />
          <ChartPreviewCard />
        </div>
      </div>
    </section>
  );
}

function ChatPreviewCard() {
  return (
    <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 80 }}>
      <Card className="p-6 h-full">
        <Badge tone="accent">Conversation</Badge>
        <div className="mt-5 space-y-4 text-sm">
          <UserBubble>What were my top 3 expense categories last month?</UserBubble>
          <AssistantBubble>
            Your top 3 expense categories in August were:<br/>
            1. <b>Food & Dining</b> — {formatINR(18420)} (24 transactions)<br/>
            2. <b>Transport</b> — {formatINR(7250)} (31 transactions)<br/>
            3. <b>Utilities</b> — {formatINR(6100)} (4 transactions)
            <div className="flex flex-wrap gap-1.5 mt-3">
              {[12, 18, 34, 47, 59, 88].map(r => (
                <span key={r} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 text-[10px] font-mono">Row {r}</span>
              ))}
            </div>
          </AssistantBubble>
        </div>
      </Card>
    </motion.div>
  );
}

function ChartPreviewCard() {
  const bars = [
    { label: "Food", val: 18420, color: "oklch(0.82 0.17 165)" },
    { label: "Transport", val: 7250, color: "oklch(0.78 0.16 220)" },
    { label: "Utilities", val: 6100, color: "oklch(0.84 0.14 88)" },
    { label: "Shopping", val: 4580, color: "oklch(0.72 0.18 305)" },
    { label: "Health", val: 2300, color: "oklch(0.68 0.21 22)" },
  ];
  const max = Math.max(...bars.map(b => b.val));
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 80 }}>
      <Card className="p-6 h-full">
        <Badge tone="primary">Auto-generated chart</Badge>
        <h4 className="mt-4 text-base font-semibold">Spend by category — August 2024</h4>
        <div className="mt-6 space-y-3">
          {bars.map((b, i) => (
            <div key={b.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-mono text-foreground">{formatINR(b.val)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-overlay overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(b.val / max) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
                  className="h-full rounded-full"
                  style={{ background: b.color, boxShadow: `0 0 16px ${b.color}` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="size-7 rounded-full bg-surface-elevated grid place-items-center text-[10px] text-muted-foreground shrink-0">You</div>
      <div className="bg-surface-elevated rounded-2xl rounded-tl-md px-3.5 py-2.5 text-foreground">{children}</div>
    </div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="size-7 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
        <Sparkles className="size-3.5 text-background" />
      </div>
      <div className="rounded-2xl rounded-tl-md px-3.5 py-2.5 text-foreground bg-surface border border-border leading-relaxed">{children}</div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Upload your statement", desc: "Drop a CSV or PDF. We support every major Indian bank and broker." },
    { n: "02", title: "We parse & index", desc: "Transactions are categorized, embedded, and made searchable in seconds." },
    { n: "03", title: "Ask anything", desc: "Plain English questions. Cited answers. Charts when they help." },
  ];
  return (
    <section id="how" className="py-28 sm:py-36 border-y border-border bg-surface/20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="How it works" title="Three steps. No spreadsheets." />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="p-7 h-full relative overflow-hidden">
                <span className="text-7xl font-bold text-primary/10 absolute -top-2 -right-2 font-display tracking-tighter">{s.n}</span>
                <div className="relative">
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Waitlist() {
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return showToast("Please enter a valid email", "error");
    setSubmitting(true);
    try {
      const r = await authApi.waitlist(email);
      showToast(r.message || "You're on the list!", "success");
      setSubmitted(true);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="waitlist" className="py-28 sm:py-36">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <Badge tone="primary"><Sparkles className="size-3" /> Limited early access</Badge>
          <h2 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
            Get FinSight before <br className="hidden sm:block"/> everyone else.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            We're rolling out access in waves. Drop your email and we'll bring you in early.
          </p>
        </motion.div>

        {isAuthenticated ? (
          <div className="mt-10">
            <Link to="/app">
              <Button size="lg" iconRight={<ArrowRight className="size-5" />}>Go to app</Button>
            </Link>
          </div>
        ) : submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="mt-10 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-success/15 text-success border border-success/30"
          >
            <CheckCircle2 className="size-5" />
            <span className="font-medium">You're in. We'll be in touch.</span>
          </motion.div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com" required
              className="flex-1 h-13 px-5 rounded-xl bg-input border border-border-strong text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring transition-all"
            />
            <Button type="submit" size="lg" loading={submitting} iconRight={<ArrowRight className="size-5" />}>Join</Button>
          </form>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10 mt-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <Logo />
        <p>&copy; {new Date().getFullYear()} FinSight AI. Made for Indian investors.</p>
      </div>
    </footer>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <Badge tone="default" className="border-border">{eyebrow}</Badge>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-muted-foreground text-lg"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
