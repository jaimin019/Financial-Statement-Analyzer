import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import BrandLockup from '../components/BrandLockup.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(''); // 'loading' | 'success' | 'error' | ''
  const [message, setMessage] = useState('');

  const handleWaitlistSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading');
    setMessage('');
    
    try {
      const res = await fetch('/api/auth/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      setStatus('success');
      setMessage(data.message || 'Added to waitlist!');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="landing-page" style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      {/* Nav */}
      <header style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
        <BrandLockup />
        {isAuthenticated ? (
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user?.email}</span>
            <button className="auth-btn" style={{ padding: '8px 16px', margin: 0, width: 'auto' }} onClick={() => navigate('/app')}>Go to Dashboard →</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <button className="ghost-btn" onClick={() => navigate('/auth?mode=login')}>Sign In</button>
            <button className="auth-btn" style={{ padding: '8px 16px', margin: 0, width: 'auto' }} onClick={() => navigate('/auth?mode=register')}>Get Started</button>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section style={{ padding: '80px 20px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '700', lineHeight: '1.2', marginBottom: '24px', background: 'linear-gradient(to right, #F0F2FF, #8B91B0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Understand your finances,<br />powered by AI.
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '40px', lineHeight: '1.6' }}>
            FinSight AI turns your raw financial statements into actionable insights. Chat with your transaction history, discover patterns, and take control of your spending.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            {isAuthenticated ? (
              <button className="auth-btn" style={{ width: 'auto', padding: '14px 32px', fontSize: '16px' }} onClick={() => navigate('/app')}>Go to your dashboard →</button>
            ) : (
              <>
                <button className="auth-btn" style={{ width: 'auto', padding: '14px 32px', fontSize: '16px' }} onClick={() => navigate('/auth?mode=register')}>Start Analyzing Now</button>
                <a href="#waitlist" className="ghost-btn" style={{ padding: '14px 32px', fontSize: '16px', display: 'flex', alignItems: 'center' }}>Join Waitlist</a>
              </>
            )}
          </div>
        </section>

        {/* Mock UI Demo */}
        <section style={{ padding: '40px 20px', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--red)' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--amber)' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--green)' }} />
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: '16px' }}>
              <p style={{ color: 'var(--text-primary)', marginBottom: '12px' }}><strong>You:</strong> How much did I spend on dining out last month?</p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>AI</div>
                <div>
                  <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
                    You spent a total of <strong style={{ color: 'white' }}>₹14,500</strong> on dining out last month across 8 transactions. Your largest expense was ₹4,200 at Barbeque Nation <span className="citation-tag">[Row 42]</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ padding: '80px 20px', maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', textAlign: 'center', marginBottom: '48px', color: 'var(--text-primary)' }}>Powerful features for deep financial clarity</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
            {[{
              title: 'Hybrid Search & RAG',
              desc: 'Ask complex questions and get precise answers backed by citations from your actual statements.'
            }, {
              title: 'Instant Categorization',
              desc: 'Automatically categorizes your transactions and identifies recurring merchants and anomalies.'
            }, {
              title: 'Interactive Charts',
              desc: 'Visualize your spending trends, top categories, and income vs expense flow dynamically.'
            }].map((f, i) => (
              <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--accent-muted)', border: '1px solid var(--accent-border)', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" style={{ padding: '80px 20px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--text-primary)' }}>Join the Waitlist</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
              We're rolling out FinSight AI to new users every week. Join the waitlist to secure your spot in the next batch.
            </p>
            <form onSubmit={handleWaitlistSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="email" 
                placeholder="Enter your email address" 
                className="auth-input" 
                style={{ flex: 1 }} 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
              />
              <button type="submit" className="auth-btn" style={{ width: 'auto', padding: '11px 24px', margin: 0 }} disabled={status === 'loading'}>
                {status === 'loading' ? <span className="btn-spinner" /> : 'Join Waitlist'}
              </button>
            </form>
            {message && (
              <p style={{ marginTop: '16px', color: status === 'error' ? 'var(--red)' : 'var(--green)' }}>{message}</p>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}>
        <p>© 2026 FinSight AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
