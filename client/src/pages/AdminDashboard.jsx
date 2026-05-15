import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiGetAdminStats } from '../services/api.js';
import BrandLockup from '../components/BrandLockup.jsx';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await apiGetAdminStats();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="typing-indicator" style={{ background: 'var(--surface)' }}>
          <span></span><span></span><span></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
        <button className="primary-btn" onClick={() => navigate('/app')}>Back to App</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-topbar">
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/app')}>
          <BrandLockup />
        </div>
        <div className="user-menu">
          <button className="ghost-btn" onClick={() => navigate('/app')}>Exit Admin</button>
        </div>
      </div>

      <motion.div 
        className="admin-dashboard" 
        style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '2rem', fontSize: '2rem', fontWeight: 600 }}>System Overview</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <StatCard title="Total Users" value={stats.metrics.totalUsers} />
          <StatCard title="Total Sessions" value={stats.metrics.totalSessions} />
          <StatCard title="Parsed Transactions" value={stats.metrics.totalTransactions} />
        </div>

        <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 500 }}>Recent Users</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Email</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Provider</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Admin</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map(user => (
                <tr key={user._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>{user.email}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'var(--surface-hover)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      {user.authProvider}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {user.isAdmin ? '✅ Yes' : 'No'}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.recentUsers.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>{title}</span>
      <span style={{ color: 'var(--primary)', fontSize: '2.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}
