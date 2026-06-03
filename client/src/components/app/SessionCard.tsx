import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { FileText, Trash2, MessageSquare, AlertCircle, CheckCircle2, FileBarChart } from "lucide-react";
import { Card } from "@/components/fs/Card";
import { Badge } from "@/components/fs/Badge";
import { FILE_TYPE_LABELS, isInvestmentType } from "@/lib/fileTypes";
import { formatRelativeTime } from "@/lib/format";
import { sessionApi, type SessionObj, extractErrorMessage } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

interface Props {
  session: SessionObj;
  onOpen: (s: SessionObj) => void;
  onDelete: (id: string) => void;
  onUpdate: (s: SessionObj) => void;
}

export function SessionCard({ session, onOpen, onDelete, onUpdate }: Props) {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Uploading…");

  // Poll job status while processing
  useEffect(() => {
    if (session.status !== "processing") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await sessionApi.jobStatus(session.sessionId);
        if (stopped) return;
        const p = r.progress ?? 0;
        setProgress(p);
        if (p < 10) setStatusText("Uploading…");
        else if (p < 70) setStatusText("Generating AI embeddings…");
        else if (p < 100) setStatusText("Building insights…");
        if (r.status === "ready") {
          const fresh = await sessionApi.get(session.sessionId);
          onUpdate(fresh);
          return;
        }
        if (r.status === "error") {
          onUpdate({ ...session, status: "error", errorMessage: r.errorMessage || "Processing failed" });
          return;
        }
        timer = setTimeout(tick, 2000);
      } catch {
        if (!stopped) timer = setTimeout(tick, 4000);
      }
    };
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [session.sessionId, session.status, onUpdate, session]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await sessionApi.delete(session.sessionId);
      showToast("Session deleted", "success");
      onDelete(session.sessionId);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
      setDeleting(false); setConfirming(false);
    }
  };

  const investment = isInvestmentType(session.fileType);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: deleting ? 0 : 1, y: 0, height: deleting ? 0 : "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      className="group"
    >
      <Card className="p-5 hover:border-primary/40 transition cursor-pointer relative" onClick={() => session.status === "ready" && onOpen(session)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="size-11 shrink-0 rounded-xl grid place-items-center"
              style={{ background: investment ? "oklch(0.78 0.16 220 / 0.15)" : "oklch(0.82 0.17 165 / 0.15)" }}
            >
              {investment ? <FileBarChart className="size-5 text-accent" /> : <FileText className="size-5 text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-foreground truncate text-[15px]">{session.filename}</h3>
                {session.status === "ready" && <Badge tone="success"><CheckCircle2 className="size-3" /> Ready</Badge>}
                {session.status === "processing" && <Badge tone="warning">Processing</Badge>}
                {session.status === "error" && <Badge tone="danger"><AlertCircle className="size-3" /> Error</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {FILE_TYPE_LABELS[session.fileType] || session.fileType} · {session.rowCount.toLocaleString("en-IN")} rows · {formatRelativeTime(session.lastActiveAt)}
              </p>
              {session.messageCount > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="size-3" /> {session.messageCount} message{session.messageCount === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
            style={{ visibility: confirming ? "hidden" : "visible" }}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {session.status === "processing" && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{statusText}</span><span className="font-mono">{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-surface-overlay overflow-hidden">
              <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} className="h-full bg-primary" />
            </div>
          </div>
        )}

        {session.status === "error" && session.errorMessage && (
          <p className="mt-3 text-xs text-destructive">{session.errorMessage}</p>
        )}

        <AnimatePresence>
          {confirming && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-foreground">Delete this session?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-surface-overlay">Cancel</button>
                  <button onClick={handleDelete} className="px-3 py-1.5 rounded-lg text-xs bg-destructive text-destructive-foreground hover:brightness-110">Delete</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
