import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getSessionInsights, fetchRows } from '../services/api.js';
import SourceDrawer from './SourceDrawer.jsx';

const fmt = (n) => Math.abs(n ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmtSigned = (n) => n >= 0 ? `+${fmt(n)}` : `-${fmt(n).replace('₹', '₹')}`;

function Skeleton() {
  return (
    <div className="insight-skeleton">
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div key={i} className="skeleton-bar" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── Investment-specific suggested queries ────────────────────
const INVESTMENT_QUERIES = {
  groww_mf: [
    'Which fund has the highest investment?',
    'Show my SIP vs lumpsum breakdown',
    'What is my total mutual fund portfolio value?',
    'Which funds have I redeemed from?',
  ],
  groww_stocks: [
    'Which stock did I trade the most?',
    'Show my buy vs sell summary',
    'What is my total brokerage cost?',
    'Which trades were the most profitable?',
  ],
  groww_holdings: [
    'What is my total portfolio value?',
    'Which stock has the highest P&L?',
    'Show my top 5 holdings by value',
    'What percentage is my largest holding?',
  ],
  zerodha_tradebook: [
    'Show my trade summary by symbol',
    'Which stock did I trade the most?',
    'What is my average buy price for each stock?',
    'List all my intraday trades',
  ],
  zerodha_pnl: [
    'What is my total realized P&L?',
    'Which symbol gave the best returns?',
    'Show my loss-making positions',
    'Compare realized vs unrealized P&L',
  ],
  zerodha_ledger: [
    'What are my total brokerage charges?',
    'Show all settlement entries',
    'What taxes and fees did I pay?',
    'What is my ledger balance trend?',
  ],
  zerodha_holdings: [
    'What is my total portfolio value?',
    'Which stock has the highest allocation?',
    'Show my top gainers and losers',
    'What is my overall P&L percentage?',
  ],
};

function generateSuggestedQueries(insights, fileType) {
  // Use investment-specific queries if applicable
  if (fileType && INVESTMENT_QUERIES[fileType]) {
    return INVESTMENT_QUERIES[fileType].slice(0, 4);
  }

  // Bank statement: insight-driven queries
  const queries = [];
  const cats = (insights.topCategories || []).map((c) => c.category?.toLowerCase() ?? '');
  if (cats.some((c) => c.includes('food') || c.includes('dining') || c.includes('restaurant'))) {
    queries.push('Break down my food delivery spend');
  }
  if (cats.some((c) => c.includes('invest') || c.includes('mutual') || c.includes('stock'))) {
    queries.push('Analyze my investment transactions');
  }
  if ((insights.unusualTransactions || []).length > 0) {
    queries.push('Explain my unusual transactions');
  }
  if ((insights.recurringMerchants || []).length > 0) {
    const top = insights.recurringMerchants[0].merchantName;
    queries.push(`How much did I spend at ${top}?`);
  }
  if (queries.length < 2) {
    queries.push('What was my largest expense?');
    queries.push('Show me all transactions this month');
  }
  return queries.slice(0, 4);
}

/**
 * InsightPanel — shown after upload or when loading a session on the dashboard.
 * Polls every 3s until insights are ready, then renders the full panel.
 */
export default function InsightPanel({ sessionId, fileType, onSendMessage }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerTxns, setDrawerTxns] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const data = await getSessionInsights(sessionId);
        if (data?.insights?.generatedAt) {
          setInsights(data.insights);
          setLoading(false);
          clearInterval(pollRef.current);
        }
      } catch {
        // 202 = still generating, keep polling
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [sessionId]);

  const handleUnusualClick = async (txn) => {
    try {
      const { rows } = await fetchRows(sessionId, [txn.rowIndex]);
      setDrawerTxns(rows);
      setDrawerOpen(true);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <motion.div
        className="insight-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="insight-header">
          <span className="insight-title">Generating Financial Summary…</span>
        </div>
        <Skeleton />
      </motion.div>
    );
  }

  const { summary, topCategories, incomeVsExpense, unusualTransactions, recurringMerchants, dateRange } = insights;
  const maxCategorySpend = Math.max(...(topCategories || []).map((c) => Math.abs(c.totalSpent)), 1);
  const netFlow = incomeVsExpense?.netFlow ?? 0;
  const suggestedQueries = generateSuggestedQueries(insights, fileType);

  const dateLabel = dateRange
    ? new Date(dateRange.start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '';

  return (
    <>
      <motion.div
        className="insight-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <motion.div
          className="insight-header"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          <span className="insight-title">Financial Summary</span>
          {dateLabel && <span className="insight-date">{dateLabel}</span>}
        </motion.div>

        {/* AI Summary */}
        {summary && (
          <motion.p
            className="insight-summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {summary}
          </motion.p>
        )}

        {/* Income / Expense / Net Flow */}
        {incomeVsExpense && (
          <motion.div
            className="insight-flow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flow-stat">
              <span className="flow-label">Income</span>
              <span className="flow-value income">{fmt(incomeVsExpense.totalIncome)}</span>
            </div>
            <div className="flow-stat">
              <span className="flow-label">Expenses</span>
              <span className="flow-value expense">{fmt(incomeVsExpense.totalExpense)}</span>
            </div>
            <div className="flow-stat">
              <span className="flow-label">Net Flow</span>
              <span className={`flow-value ${netFlow >= 0 ? 'income' : 'expense'}`}>
                {fmtSigned(netFlow)}
              </span>
            </div>
          </motion.div>
        )}

        {/* Top Categories */}
        {topCategories?.length > 0 && (
          <motion.div
            className="insight-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="insight-section-title">Top categories</div>
            {topCategories.map((cat, i) => (
              <div key={cat.category} className="category-row">
                <span className="category-name">{cat.category}</span>
                <div className="category-bar-track">
                  <motion.div
                    className="category-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.abs(cat.totalSpent) / maxCategorySpend) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
                <span className="category-amount">
                  {fmt(cat.totalSpent)} ({cat.percentOfTotal}%)
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Unusual transactions */}
        {unusualTransactions?.length > 0 && (
          <motion.div
            className="insight-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <div className="insight-section-title">
              Unusual transactions ({unusualTransactions.length})
            </div>
            {unusualTransactions.map((txn, i) => {
              const amountColor = txn.amount > 0 || txn.direction === 'credit' ? 'var(--amber)' : 'var(--red)';
              return (
              <div
                key={i}
                className="unusual-row"
                onClick={() => handleUnusualClick(txn)}
                title="Click to view transaction"
              >
                <span className="unusual-amount" style={{ color: amountColor }}>{fmt(txn.amount)}</span>
                <span className="unusual-merchant">{txn.merchantName || 'Unknown'}</span>
                <span className="unusual-zscore">{Math.abs(txn.zScore).toFixed(1)}σ above avg</span>
              </div>
              );
            })}
          </motion.div>
        )}

        {/* Recurring merchants */}
        {recurringMerchants?.length > 0 && (
          <motion.div
            className="insight-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="insight-section-title">Recurring</div>
            <div className="recurring-list">
              {recurringMerchants.map((m) => (
                <span key={m.merchantName} className="recurring-chip">
                  {m.merchantName} ({m.count}×)
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Suggested queries */}
        {suggestedQueries.length > 0 && (
          <motion.div
            className="insight-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <div className="insight-section-title">Try asking</div>
            <div className="query-chips">
              {suggestedQueries.map((q) => (
                <button
                  key={q}
                  className="query-chip"
                  onClick={() => onSendMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      <SourceDrawer
        transactions={drawerTxns}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
