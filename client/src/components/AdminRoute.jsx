import { useAuth } from '../hooks/useAuth.js';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * AdminRoute — wraps routes requiring admin privileges.
 * Redirects non-admin users to /app. Redirects unauthenticated
 * users to /auth (same as ProtectedRoute).
 */
export default function AdminRoute({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
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

  if (!user?.isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
