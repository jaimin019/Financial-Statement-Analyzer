import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Database, Activity, Trash2 } from "lucide-react";
import { AppNav } from "@/components/app/AppNav";
import { Card } from "@/components/fs/Card";
import { Skeleton } from "@/components/fs/Skeleton";
import { Badge } from "@/components/fs/Badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { adminApi, extractErrorMessage } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin")({ component: AdminPage });

interface Stats {
  totalUsers: number; newUsersToday: number; newUsersThisWeek: number;
  totalSessions: number; activeSessions: number;
  totalChunks: number; totalTransactions: number;
  waitlistCount: number; cacheHitRate: number; queueDepth: number; activeJobs: number;
}
interface AdminUser { _id: string; email: string; authProvider: string; isAdmin: boolean; createdAt: string; lastLoginAt: string; sessionCount: number }
interface AdminSession { sessionId: string; filename: string; fileType: string; rowCount: number; status: string; uploadedAt: string; userEmail: string }

function AdminPage() {
  const { user, isReady, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [sessions, setSessions] = useState<AdminSession[] | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user?.isAdmin) navigate({ to: "/app", replace: true });
  }, [isReady, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    adminApi.stats().then(setStats).catch(() => {});
    adminApi.users({ page: 1, limit: 20 }).then(r => setUsers(r.users)).catch(() => setUsers([]));
    adminApi.sessions().then(r => setSessions(r.sessions)).catch(() => setSessions([]));
  }, [user]);

  const deleteUser = async (id: string) => {
    if (id === user?.userId) return showToast("Cannot delete yourself", "error");
    try {
      await adminApi.deleteUser(id);
      setUsers(us => us ? us.filter(u => u._id !== id) : us);
      showToast("User deleted", "success");
    } catch (err) { showToast(extractErrorMessage(err), "error"); }
  };

  if (!isReady || !user?.isAdmin) return null;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        <div>
          <Badge tone="primary">Admin</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">System overview</h1>
        </div>

        {!stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0,1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={Users} label="Total users" value={stats.totalUsers} />
            <StatTile icon={Users} label="New today" value={stats.newUsersToday} />
            <StatTile icon={Database} label="Sessions" value={stats.totalSessions} />
            <StatTile icon={Activity} label="Active jobs" value={stats.activeJobs} />
            <StatTile icon={Database} label="Transactions" value={stats.totalTransactions} />
            <StatTile icon={Database} label="Chunks" value={stats.totalChunks} />
            <StatTile icon={Activity} label="Cache hit" value={`${stats.cacheHitRate}%`} />
            <StatTile icon={Users} label="Waitlist" value={stats.waitlistCount} />
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-4">Users</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Provider</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Sessions</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Last login</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {!users ? (
                  <tr><td colSpan={5} className="p-6"><Skeleton className="h-8" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted-foreground p-6">No users</td></tr>
                ) : users.map((u, i) => (
                  <motion.tr key={u._id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="border-t border-border"
                  >
                    <td className="px-4 py-3 truncate max-w-[200px]">
                      {u.email} {u.isAdmin && <Badge tone="primary" className="ml-1">Admin</Badge>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{u.authProvider}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{u.sessionCount}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteUser(u._id)} className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-grid">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Recent sessions</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">File</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">User</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Rows</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {!sessions ? (
                  <tr><td colSpan={4} className="p-6"><Skeleton className="h-8" /></td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-muted-foreground p-6">No sessions</td></tr>
                ) : sessions.map((s, i) => (
                  <motion.tr key={s.sessionId}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="border-t border-border"
                  >
                    <td className="px-4 py-3 truncate max-w-[200px]">{s.filename}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground truncate max-w-[180px]">{s.userEmail}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{s.rowCount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <Badge tone={s.status === "ready" ? "success" : s.status === "error" ? "danger" : "warning"}>{s.status}</Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </main>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <Icon className="size-3.5" /> {label}
        </div>
        <p className="mt-1 text-2xl font-semibold font-mono">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
      </Card>
    </motion.div>
  );
}
