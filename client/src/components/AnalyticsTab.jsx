import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import {
  getAnalyticsOverview, getAnalyticsByCategory,
  getAnalyticsByMonth, getAnalyticsByMerchant, getAnalyticsTrends,
  getPortfolioSummary, getSymbolPnL, getFundPerformance,
  listSessions, listWorkspaces,
} from '../services/api.js';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#4f46e5', '#818cf8', '#6d28d9'];

function formatCurrency(n) {
  if (n == null) return '₹0';
  return '₹' + Math.abs(n).toLocaleString('en-IN');
}

function Skeleton({ height = 200 }) {
  return (
    <div className="skeleton-card" style={{
      height, borderRadius: 12, background: 'var(--surface)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 50%, var(--surface) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
    </div>
  );
}

export default function AnalyticsTab() {
  const [scope, setScope] = useState({ type: 'all' });
  const [viewMode, setViewMode] = useState('spending'); // 'spending' or 'investments'
  const [sessions, setSessions] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  
  const [overview, setOverview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [months, setMonths] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [trends, setTrends] = useState([]);
  
  const [portfolio, setPortfolio] = useState(null);
  const [symbols, setSymbols] = useState([]);
  const [funds, setFunds] = useState([]);
  const [totalPnL, setTotalPnL] = useState(0);
  
  const [loading, setLoading] = useState(true);

  // Load scope options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const [sessData, wsData] = await Promise.all([listSessions(), listWorkspaces()]);
        const sessList = Array.isArray(sessData) ? sessData : (sessData?.sessions || []);
        setSessions(sessList);
        setWorkspaces(wsData.workspaces || []);
      } catch (err) {
        console.error('Failed to load scope options:', err);
      }
    }
    loadOptions();
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (scope.type === 'session') params.sessionId = scope.id;
    if (scope.type === 'workspace') params.workspaceId = scope.id;

    try {
      const [ov, cat, mon, mer, tr, port, sym, fnd] = await Promise.all([
        getAnalyticsOverview(params),
        getAnalyticsByCategory(params),
        getAnalyticsByMonth(params),
        getAnalyticsByMerchant(params),
        getAnalyticsTrends(params),
        getPortfolioSummary(params),
        getSymbolPnL(params),
        getFundPerformance(params),
      ]);
      setOverview(ov);
      setCategories(cat.categories || []);
      setMonths(mon.months || []);
      setMerchants(mer.merchants || []);
      setTrends(tr.weeks || []);
      
      setPortfolio(port);
      setSymbols(sym.symbols || []);
      setTotalPnL(sym.totalPnL || 0);
      setFunds(fnd.funds || []);
      
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const isEmpty = !loading && overview && overview.transactionCount === 0;
  const hasInvestmentData = !loading && (
    (portfolio && portfolio.totalValue > 0) || 
    symbols.length > 0 || 
    funds.length > 0
  );

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div style={{ padding: '2rem 0', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Scope selector */}
      <div style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Analyze:</label>
        <select
          value={scope.type === 'all' ? 'all' : `${scope.type}:${scope.id}`}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'all') setScope({ type: 'all' });
            else {
              const [type, id] = val.split(':');
              setScope({ type, id });
            }
          }}
          style={{
            padding: '0.5rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', minWidth: 200,
          }}
        >
          <option value="all">All Statements</option>
          {sessions.length > 0 && <optgroup label="Sessions">
            {sessions.map(s => (
              <option key={s.sessionId || s._id} value={`session:${s.sessionId}`}>{s.filename}</option>
            ))}
          </optgroup>}
          {workspaces.length > 0 && <optgroup label="Workspaces">
            {workspaces.map(w => (
              <option key={w._id} value={`workspace:${w._id}`}>{w.name}</option>
            ))}
          </optgroup>}
        </select>
      </div>

      {hasInvestmentData && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: 'var(--surface)', padding: '0.25rem', borderRadius: 12, width: 'fit-content', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setViewMode('spending')}
            style={{
              padding: '0.5rem 1.5rem', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
              background: viewMode === 'spending' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'spending' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Spending
          </button>
          <button
            onClick={() => setViewMode('investments')}
            style={{
              padding: '0.5rem 1.5rem', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
              background: viewMode === 'investments' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'investments' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Investments
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No transaction data to analyze.</p>
          <p style={{ fontSize: '0.875rem' }}>Add statements to this workspace to see insights.</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <Skeleton height={100} /><Skeleton height={100} /><Skeleton height={100} />
          </div>
          <Skeleton height={280} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
            <Skeleton height={260} /><Skeleton height={260} />
          </div>
          <div style={{ marginTop: '1.5rem' }}><Skeleton height={240} /></div>
        </>
      )}

      {/* Charts */}
      {!loading && !isEmpty && (
        <>
          {viewMode === 'spending' && overview && (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <KPICard label="Total Income" value={formatCurrency(overview.totalIncome)} color="#22c55e" />
                <KPICard label="Total Expense" value={formatCurrency(overview.totalExpense)} color="#ef4444" />
                <KPICard label="Net Flow" value={formatCurrency(overview.netFlow)} color={overview.netFlow >= 0 ? '#22c55e' : '#ef4444'} />
              </div>

              {/* Chart 1: Income vs Expense bar */}
              <ChartCard title="Income vs Expense">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[{ name: 'Summary', Income: overview.totalIncome, Expense: overview.totalExpense }]} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                    <Bar dataKey="Income" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Expense" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Chart 2: Monthly trend */}
              {months.length > 0 && (
                <ChartCard title="Monthly Trend">
                  <ResponsiveContainer width="100%" height={260}>
                    {months.length === 1 ? (
                      <BarChart data={months}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                        <Bar dataKey="totalIncome" name="Income" fill="#22c55e" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="totalExpense" name="Expense" fill="#ef4444" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : (
                      <LineChart data={isMobile ? months.slice(-6) : months}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                        <Line type="monotone" dataKey="totalIncome" name="Income" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="totalExpense" name="Expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="netFlow" name="Net" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Chart 3 & 4: Side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                {/* Chart 3: Category breakdown */}
                {categories.length > 0 && (
                  <ChartCard title="Spending by Category">
                    <ResponsiveContainer width="100%" height={Math.max(200, categories.slice(0, 8).length * 36)}>
                      <BarChart data={categories.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                        <YAxis type="category" dataKey="category" width={100} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                        <Bar dataKey="totalSpent" name="Spent" radius={[0, 6, 6, 0]}>
                          {categories.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Chart 4: Top merchants table */}
                {merchants.length > 0 && (
                  <ChartCard title="Top Merchants">
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>#</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>Merchant</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 500 }}>Spent</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 500 }}>Txns</th>
                          </tr>
                        </thead>
                        <tbody>
                          {merchants.slice(0, 10).map((m, i) => (
                            <tr key={m.merchantName} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-hover)' }}>
                              <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{i + 1}</td>
                              <td style={{ padding: '0.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>{m.merchantName}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(m.totalSpent)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{m.transactionCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                )}
              </div>

              {/* Chart 5: Weekly trend area chart */}
              {trends.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <ChartCard title="Weekly Spending Trend">
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={isMobile ? trends.slice(-6) : trends}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="weekLabel" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                        <Area type="monotone" dataKey="totalSpend" name="Spend" stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 4, fill: '#6366f1' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}
            </>
          )}

          {viewMode === 'investments' && hasInvestmentData && (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <KPICard label="Total Invested" value={formatCurrency((portfolio?.totalInvested || 0) + (funds?.reduce((s,f)=>s+f.totalPurchased, 0) || 0))} color="var(--text-primary)" />
                <KPICard label="Current Value" value={formatCurrency((portfolio?.totalValue || 0))} color="var(--primary)" />
                <KPICard label="Net P&L" value={formatCurrency((portfolio?.totalPnL || 0) + totalPnL)} color={(portfolio?.totalPnL || 0) + totalPnL >= 0 ? '#22c55e' : '#ef4444'} />
              </div>

              {/* Chart: Portfolio / Holdings */}
              {portfolio && portfolio.holdings?.length > 0 && (
                <ChartCard title="Portfolio Allocation">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={portfolio.holdings}
                        dataKey="currentValue"
                        nameKey="symbol"
                        cx="50%" cy="50%"
                        outerRadius={100}
                        label={({ symbol, percent }) => `${symbol} ${(percent * 100).toFixed(0)}%`}
                      >
                        {portfolio.holdings.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                {/* Chart: Symbol PnL */}
                {symbols && symbols.length > 0 && (
                  <ChartCard title="P&L By Symbol">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={symbols} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                        <YAxis type="category" dataKey="symbol" width={100} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                        <Bar dataKey="pnl" name="P&L" radius={[0, 6, 6, 0]}>
                          {symbols.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Chart: Mutual Funds */}
                {funds && funds.length > 0 && (
                  <ChartCard title="Mutual Fund Performance">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={funds} margin={{ top: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="fundName" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="totalPurchased" name="Invested" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalRedeemed" name="Redeemed" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function KPICard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem',
    }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>{label}</span>
      <span style={{ color, fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      padding: '1.25rem', marginBottom: 0,
    }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>{title}</h3>
      {children}
    </div>
  );
}
