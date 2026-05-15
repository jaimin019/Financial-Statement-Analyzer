import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLockup from '../components/BrandLockup.jsx';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
    else navigate('/app', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '500px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <BrandLockup />
        </div>
        
        {step === 1 && (
          <div>
            <h1 className="auth-title">Welcome to FinSight AI</h1>
            <p className="auth-subtitle">Your personal intelligent financial assistant.</p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                We're excited to have you on board. Over the next few minutes, we'll show you how to get the most out of our platform.
              </p>
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div>
            <h1 className="auth-title">Upload Statements</h1>
            <p className="auth-subtitle">Analyze your spending securely</p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Upload your bank or credit card statements in CSV format. We use advanced LLMs and RAG to understand your transaction history securely.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="auth-title">Ask Questions</h1>
            <p className="auth-subtitle">Get intelligent financial insights</p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Ask complex questions like "How much did I spend on dining out last month?" or "What's my biggest recurring expense?". FinSight AI gives you precise, cited answers.
              </p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: i === step ? 'var(--accent)' : 'var(--bg-active)' 
                }} 
              />
            ))}
          </div>
          <button className="auth-btn" style={{ width: 'auto', padding: '11px 32px' }} onClick={nextStep}>
            {step === 3 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
