import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus, Folder, MessageSquare, Trash2 } from "lucide-react";
import { Card } from "@/components/fs/Card";
import { Button } from "@/components/fs/Button";
import { Skeleton } from "@/components/fs/Skeleton";
import { Badge } from "@/components/fs/Badge";
import { workspaceApi, type Workspace, type SessionObj, extractErrorMessage } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { formatRelativeTime } from "@/lib/format";

interface Props {
  sessions: SessionObj[];
}

export function WorkspacesTab({ sessions }: Props) {
  const { showToast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    workspaceApi.list().then(setWorkspaces).catch(() => setWorkspaces([]));
  }, []);

  const create = async () => {
    if (!name.trim()) return showToast("Name required", "error");
    setSubmitting(true);
    try {
      const w = await workspaceApi.create({ name: name.trim(), sessionIds: selectedIds });
      setWorkspaces(ws => ws ? [w, ...ws] : [w]);
      setCreating(false); setName(""); setSelectedIds([]);
      showToast("Workspace created", "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally { setSubmitting(false); }
  };

  const remove = async (id: string) => {
    try {
      await workspaceApi.delete(id);
      setWorkspaces(ws => ws ? ws.filter(w => w._id !== id) : ws);
      showToast("Workspace deleted", "success");
    } catch (err) { showToast(extractErrorMessage(err), "error"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Workspaces</h2>
          <p className="text-sm text-muted-foreground">Group multiple statements to query across them.</p>
        </div>
        <Button size="sm" iconLeft={<FolderPlus className="size-4" />} onClick={() => setCreating(c => !c)}>
          New workspace
        </Button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-5">
              <input
                value={name} onChange={e => setName(e.target.value)} placeholder="Workspace name"
                className="w-full h-11 px-4 rounded-xl bg-input border border-border-strong focus:outline-none focus:border-primary mb-3"
              />
              <p className="text-xs text-muted-foreground mb-2">Add sessions:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {sessions.filter(s => s.status === "ready").map(s => {
                  const sel = selectedIds.includes(s.sessionId);
                  return (
                    <button key={s.sessionId}
                      onClick={() => setSelectedIds(ids => sel ? ids.filter(x => x !== s.sessionId) : [...ids, s.sessionId])}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        sel ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-muted-foreground"
                      }`}>
                      {s.filename}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                <Button size="sm" loading={submitting} onClick={create}>Create</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!workspaces ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : workspaces.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="size-12 rounded-2xl bg-surface-overlay grid place-items-center mx-auto mb-4">
            <Folder className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No workspaces yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Group sessions to ask cross-file questions.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {workspaces.map((w, i) => (
              <motion.div key={w._id} layout
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="p-5 hover:border-accent/40 transition group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{w.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {w.sessionIds.length} session{w.sessionIds.length === 1 ? "" : "s"} · {formatRelativeTime(w.updatedAt)}
                      </p>
                      {w.messageCount > 0 && (
                        <Badge tone="accent" className="mt-2"><MessageSquare className="size-3" /> {w.messageCount}</Badge>
                      )}
                    </div>
                    <button onClick={() => remove(w._id)} className="opacity-0 group-hover:opacity-100 transition size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
