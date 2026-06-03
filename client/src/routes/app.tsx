import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Folder, BarChart3, Plus } from "lucide-react";
import { AppNav } from "@/components/app/AppNav";
import { UploadDropzone } from "@/components/app/UploadDropzone";
import { SessionCard } from "@/components/app/SessionCard";
import { ChatView } from "@/components/chat/ChatView";
import { AnalyticsTab } from "@/components/dashboard/AnalyticsTab";
import { WorkspacesTab } from "@/components/dashboard/WorkspacesTab";
import { Card } from "@/components/fs/Card";
import { Skeleton } from "@/components/fs/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { sessionApi, type SessionObj } from "@/lib/api";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

type Tab = "statements" | "workspaces" | "analytics";

interface NavState {
  view?: "dashboard" | "chat" | "workspace-chat";
  session?: SessionObj;
}

function AppShell() {
  const { isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const router = useRouter();
  const navState = (location.state as NavState) || {};
  const view = navState.view ?? "dashboard";
  const [tab, setTab] = useState<Tab>("statements");
  const [sessions, setSessions] = useState<SessionObj[] | null>(null);

  // Auth gate
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      navigate({ to: "/auth", replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  const loadSessions = useCallback(async () => {
    try {
      const s = await sessionApi.list();
      setSessions(s);
    } catch { setSessions([]); }
  }, []);

  useEffect(() => { if (isAuthenticated) loadSessions(); }, [isAuthenticated, loadSessions]);

  const handleUploaded = useCallback(async (sessionId: string) => {
    try {
      const s = await sessionApi.get(sessionId);
      setSessions(prev => prev ? [s, ...prev] : [s]);
    } catch {/* ignore */}
  }, []);

  const updateSession = useCallback((updated: SessionObj) => {
    setSessions(prev => prev ? prev.map(s => s.sessionId === updated.sessionId ? updated : s) : prev);
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions(prev => prev ? prev.filter(s => s.sessionId !== id) : prev);
  }, []);

  const openChat = useCallback((session: SessionObj) => {
    navigate({ to: "/app", state: { view: "chat", session } as never });
  }, [navigate]);

  if (!isReady || !isAuthenticated) return null;

  return (
    <div className="min-h-screen">
      <AppNav />
      <AnimatePresence mode="wait">
        {view === "chat" && navState.session ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ChatView session={navState.session} onBack={() => router.history.back()} />
          </motion.div>
        ) : (
          <motion.main
            key="dashboard"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10"
          >
            <TabBar tab={tab} setTab={setTab} />
            <div className="mt-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {tab === "statements" && (
                    <StatementsTab
                      sessions={sessions} onUploaded={handleUploaded}
                      onOpen={openChat} onDelete={removeSession} onUpdate={updateSession}
                    />
                  )}
                  {tab === "workspaces" && <WorkspacesTab sessions={sessions || []} />}
                  {tab === "analytics" && <AnalyticsTab sessions={sessions || []} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "statements", label: "Statements", icon: FileText },
    { id: "workspaces", label: "Workspaces", icon: Folder },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];
  return (
    <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-xl w-full sm:w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`relative px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
            tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab === t.id && (
            <motion.span
              layoutId="tab-bg" transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="absolute inset-0 bg-surface-overlay rounded-lg"
            />
          )}
          <t.icon className="size-4 relative" />
          <span className="relative">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function StatementsTab({ sessions, onUploaded, onOpen, onDelete, onUpdate }: {
  sessions: SessionObj[] | null;
  onUploaded: (id: string) => void;
  onOpen: (s: SessionObj) => void;
  onDelete: (id: string) => void;
  onUpdate: (s: SessionObj) => void;
}) {
  return (
    <div className="space-y-6">
      <UploadDropzone onUploaded={onUploaded} />
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Your statements {sessions && `(${sessions.length})`}
        </h2>
        {!sessions ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="p-10 text-center">
            <div className="size-12 rounded-2xl bg-surface-overlay grid place-items-center mx-auto mb-4">
              <Plus className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No statements yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Upload your first statement to get started.</p>
          </Card>
        ) : (
          <motion.div
            initial="hidden" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <AnimatePresence>
              {sessions.map(s => (
                <SessionCard key={s.sessionId} session={s} onOpen={onOpen} onDelete={onDelete} onUpdate={onUpdate} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
