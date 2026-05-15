import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import BrandLockup from './BrandLockup.jsx';
import GoogleAuthButton from './GoogleAuthButton.jsx';

export default function RegisterForm({ onSwitch }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = 'Enter a valid email address.';
    }
    if (password.length < 8) {
      e.password = 'Password must be at least 8 characters.';
    } else if (!/\d/.test(password)) {
      e.password = 'Password must contain at least one number.';
    }
    if (password !== confirm) {
      e.confirm = 'Passwords do not match.';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await register(email, password);
      // Replace /auth with /app in history
      navigate('/app', { replace: true });
    } catch (err) {
      setApiError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header-wrapper">
          <BrandLockup />
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Start analyzing your financial statements</p>
        </div>
        <GoogleAuthButton mode="signup" />
        <div className="auth-divider">or sign up with email</div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              className={`auth-input ${errors.email ? 'input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className={`auth-input ${errors.password ? 'input-error' : ''}`}
              placeholder="Min. 8 chars with a number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              className={`auth-input ${errors.confirm ? 'input-error' : ''}`}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <span className="field-error">{errors.confirm}</span>}
          </div>
          {apiError && <p className="auth-error">{apiError}</p>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Create Account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account?{' '}
          <button className="auth-link" onClick={onSwitch}>Sign In</button>
        </p>
      </div>
    </div>
  );
}
