import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import BrandLockup from '../components/BrandLockup.jsx';

export default function OAuthCallback() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get('token');
    const isNew = params.get('isNew') === 'true';

    if (token) {
      // Strip token from URL immediately for security
      window.history.replaceState({}, document.title, window.location.pathname);
      
      loginWithToken(token);
      
      if (isNew) {
        navigate('/app/onboarding', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } else {
      setError('Authentication failed or token missing.');
      setTimeout(() => navigate('/auth'), 3000);
    }
  }, [search, navigate, loginWithToken]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <BrandLockup />
        {error ? (
          <p className="auth-error" style={{ marginTop: '24px' }}>{error}</p>
        ) : (
          <>
            <p className="auth-subtitle" style={{ marginTop: '24px' }}>Completing sign in...</p>
            <span className="btn-spinner" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', marginTop: '16px' }} />
          </>
        )}
      </div>
    </div>
  );
}
