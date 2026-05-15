import { useNavigate } from 'react-router-dom';
import BrandLockup from '../components/BrandLockup.jsx';

/**
 * 404 Not Found page — catches all unknown routes.
 */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: '16px',
      color: 'var(--text-secondary)',
      background: 'var(--bg-base)',
    }}>
      <BrandLockup />
      <span style={{
        fontSize: '64px', fontWeight: 500,
        color: 'var(--text-tertiary)', marginTop: '24px',
      }}>
        404
      </span>
      <p style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
        Page not found
      </p>
      <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '320px' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <button
        onClick={() => navigate('/', { replace: true })}
        className="auth-btn"
        style={{ marginTop: '8px', width: 'auto', padding: '11px 32px' }}
      >
        Go home
      </button>
    </div>
  );
}
