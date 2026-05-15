import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import BrandLockup from './BrandLockup.jsx';
import GoogleAuthButton from './GoogleAuthButton.jsx';

export default function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Replace /auth with /app in history — swipe back goes to /, not /auth
      const returnTo = location.state?.returnTo ?? '/app';
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header-wrapper">
          <BrandLockup />
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to analyze your financial data</p>
        </div>
        <GoogleAuthButton mode="signin" />
        <div className="auth-divider">or sign in with email</div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Sign In'}
          </button>
        </form>
        <p className="auth-switch">
          Don&apos;t have an account?{' '}
          <button className="auth-link" onClick={onSwitch}>Register</button>
        </p>
      </div>
    </div>
  );
}
