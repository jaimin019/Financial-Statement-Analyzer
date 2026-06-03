import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LogOut, LayoutDashboard, BookOpen, Shield } from "lucide-react";
import { Logo } from "@/components/fs/Logo";
import { useAuth } from "@/contexts/AuthContext";

export function AppNav() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (profile?.displayName || profile?.email || user?.email || "U").slice(0, 2).toUpperCase();
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="sticky top-0 z-40 border-b border-border glass"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="shrink-0"><Logo /></Link>
        <nav className="hidden sm:flex items-center gap-1">
          <Link to="/app" className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated flex items-center gap-1.5">
            <LayoutDashboard className="size-4" /> Dashboard
          </Link>
          <Link to="/app/integrations" className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated flex items-center gap-1.5">
            <BookOpen className="size-4" /> Integrations
          </Link>
          {user?.isAdmin && (
            <Link to="/admin" className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated flex items-center gap-1.5">
              <Shield className="size-4" /> Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs text-muted-foreground">Signed in as</span>
            <span className="text-sm font-medium truncate max-w-[180px]">{profile?.email || user?.email}</span>
          </div>
          <div className="size-9 rounded-full grid place-items-center font-semibold text-sm" style={{ background: "var(--gradient-primary)", color: "oklch(0.15 0.02 250)" }}>
            {initials}
          </div>
          <button
            onClick={() => { logout(); navigate({ to: "/", replace: true }); }}
            className="size-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
