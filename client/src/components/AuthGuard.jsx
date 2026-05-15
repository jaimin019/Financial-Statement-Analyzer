import { useAuth } from '../hooks/useAuth.js';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * AuthGuard — wraps /auth route.
 * Redirects authenticated users AWAY from auth pages to /app (or returnTo).
 * Prevents logged-in users from seeing the login form.
 */
export default function AuthGuard({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        color: 'var(--text-secondary)', fontSize: '13px',
        gap: '10px'
      }}>
        <span className="btn-spinner" />
        Loading…
      </div>
    );
  }

  if (isAuthenticated) {
    const returnTo = location.state?.returnTo ?? '/app';
    return <Navigate to={returnTo} replace />;
  }

  return children;
}
