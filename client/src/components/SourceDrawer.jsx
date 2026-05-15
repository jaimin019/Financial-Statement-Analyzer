import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Source drawer with Framer Motion spring physics animation.
 * Replaces the previous CSS translateX transition.
 */
export default function SourceDrawer({ transactions, isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
          >
            <div className="drawer-header">
              <h2>Source transactions</h2>
              <button className="drawer-close" onClick={onClose}>×</button>
            </div>
            <div className="drawer-body">
              {(!transactions || transactions.length === 0) ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  No source transactions to display.
                </p>
              ) : (
                transactions.map((txn) => (
                  <TransactionCard key={txn._id || txn.rowIndex} txn={txn} />
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TransactionCard({ txn }) {
  const [showRaw, setShowRaw] = useState(false);

  const date = txn.normalizedDate
    ? new Date(txn.normalizedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';

  const amountVal = txn.normalizedAmount || 0;
  const isCredit = amountVal >= 0 || txn.direction === 'credit';
  const prefix = amountVal > 0 ? '+' : '';
  const amount = `${prefix}${amountVal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`;

  const direction = txn.direction ? txn.direction.charAt(0).toUpperCase() + txn.direction.slice(1) : 'Unknown';
  const rawEntries = txn.rawData ? Object.entries(typeof txn.rawData === 'object' ? txn.rawData : {}) : [];

  return (
    <div className="txn-card">
      <div className="txn-card-header">
        <span className="row-badge">Row {txn.rowIndex}</span>
        <span className="txn-date">{date}</span>
      </div>
      <div className="txn-merchant">{txn.merchantName || 'Unknown'}</div>
      <div className={`txn-amount ${isCredit ? 'credit' : 'debit'}`}>{amount}</div>
      <div className="txn-badges">
        <span className="txn-badge direction">{direction}</span>
        {txn.category && <span className="txn-badge category">{txn.category}</span>}
      </div>
      {rawEntries.length > 0 && (
        <>
          <button className="raw-data-toggle" onClick={() => setShowRaw(!showRaw)}>
            Raw data {showRaw ? '↑' : '↓'}
          </button>
          {showRaw && (
            <table className="raw-data-table">
              <tbody>
                {rawEntries.map(([key, val]) => (
                  <tr key={key}><td>{key}</td><td>{val || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
