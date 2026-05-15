import { motion } from 'framer-motion';
import BrandLockup from '../components/BrandLockup.jsx';

export default function Integrations() {
  return (
    <div className="app-container" style={{ padding: '2rem 0', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Integrations & Supported Formats
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Learn how to export your financial data from supported platforms to analyze in FinSight AI.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '2rem', padding: '0 1.5rem' }}>
        
        {/* Bank Statements */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            🏦 Bank Statements
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            FinSight AI currently supports CSV exports from HDFC Bank.
          </p>
          <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>How to export from HDFC NetBanking:</h4>
            <ol style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Login to HDFC NetBanking.</li>
              <li>Go to <strong>Enquire</strong> &gt; <strong>Download Historical Statement</strong>.</li>
              <li>Select your account and the date range.</li>
              <li>Select the format as <strong>Delimited (CSV)</strong> and click Download.</li>
            </ol>
          </div>
        </div>

        {/* Groww */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, background: '#00d09c', borderRadius: '50%', display: 'inline-block' }}></span>
            Groww
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Support for Mutual Funds, Stocks, and Holdings data.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Mutual Fund Order History</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Go to Profile &gt; Reports &gt; Mutual Funds &gt; Order History. Download as CSV.
              </p>
            </div>
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Stocks Order History</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Go to Profile &gt; Reports &gt; Stocks &gt; Order History. Download as CSV.
              </p>
            </div>
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Portfolio Holdings</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Go to Portfolio &gt; Stocks. Click "Download" to get your holdings CSV.
              </p>
            </div>
          </div>
        </div>

        {/* Zerodha */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, background: '#387ed1', borderRadius: '50%', display: 'inline-block' }}></span>
            Zerodha (Console)
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Support for Tradebook, P&L, Ledger, and Holdings data.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Tradebook</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Console &gt; Reports &gt; Tradebook. Select date range and click Download CSV.
              </p>
            </div>
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>P&L Report</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Console &gt; Reports &gt; P&L. Select Combined or Equity and click Download CSV.
              </p>
            </div>
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Ledger</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Console &gt; Funds &gt; Statement. Click Download CSV.
              </p>
            </div>
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Holdings</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Console &gt; Portfolio &gt; Holdings. Click Download CSV.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
