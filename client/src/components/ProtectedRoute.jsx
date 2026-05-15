import { useAuth } from '../hooks/useAuth.js';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * ProtectedRoute — wraps routes requiring authentication.
 * Redirects unauthenticated users to /auth with returnTo state
 * so they return to the original page after login.
 * Uses `replace` so /auth doesn't stack on /app in history.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        color: 'var(--text-secondary)', fontSize: '13px',
        gap: '10px',
        background: 'var(--bg-base)',
      }}>
        <span className="btn-spinner" />
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth"
        state={{ returnTo: location.pathname }}
        replace
      />
    );
  }

  return children;
}
