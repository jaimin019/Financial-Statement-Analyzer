import { Router } from 'express';
import Session from '../models/Session.js';
import Workspace from '../models/Workspace.js';
import RawTransaction from '../models/RawTransaction.js';

const router = Router();

/**
 * Helper: resolve query params to a list of sessionIds the user owns.
 */
async function resolveSessionIds(req) {
  const { workspaceId, sessionId } = req.query;

  if (workspaceId) {
    const ws = await Workspace.findOne({ _id: workspaceId, userId: req.user.userId }).lean();
    if (!ws) return [];
    const sessions = await Session.find({ _id: { $in: ws.sessionIds }, userId: req.user.userId }, { sessionId: 1 }).lean();
    return sessions.map(s => s.sessionId);
  }

  if (sessionId) {
    const s = await Session.findOne({ sessionId, userId: req.user.userId }, { sessionId: 1 }).lean();
    return s ? [s.sessionId] : [];
  }

  // Default: all user sessions
  const all = await Session.find({ userId: req.user.userId }, { sessionId: 1 }).lean();
  return all.map(s => s.sessionId);
}

/**
 * GET /api/analytics/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ totalIncome: 0, totalExpense: 0, netFlow: 0, transactionCount: 0, dateRange: null, avgMonthlySpend: 0 });

    const [result] = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $gt: ['$normalizedAmount', 0] }, '$normalizedAmount', 0] } },
          totalExpense: { $sum: { $cond: [{ $lt: ['$normalizedAmount', 0] }, { $abs: '$normalizedAmount' }, 0] } },
          transactionCount: { $sum: 1 },
          minDate: { $min: '$normalizedDate' },
          maxDate: { $max: '$normalizedDate' },
        },
      },
    ]);

    if (!result) return res.json({ totalIncome: 0, totalExpense: 0, netFlow: 0, transactionCount: 0, dateRange: null, avgMonthlySpend: 0 });

    const months = result.minDate && result.maxDate
      ? Math.max(1, Math.ceil((new Date(result.maxDate) - new Date(result.minDate)) / (1000 * 60 * 60 * 24 * 30)))
      : 1;

    res.json({
      totalIncome: result.totalIncome,
      totalExpense: result.totalExpense,
      netFlow: result.totalIncome - result.totalExpense,
      transactionCount: result.transactionCount,
      dateRange: result.minDate ? { start: result.minDate, end: result.maxDate } : null,
      avgMonthlySpend: Math.round(result.totalExpense / months),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/by-category
 */
router.get('/by-category', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ categories: [] });

    const categories = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: sessionIds }, normalizedAmount: { $lt: 0 } } },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: { $abs: '$normalizedAmount' } },
          transactionCount: { $sum: 1 },
          avgTransactionSize: { $avg: { $abs: '$normalizedAmount' } },
        },
      },
      { $sort: { totalSpent: -1 } },
    ]);

    const grandTotal = categories.reduce((s, c) => s + c.totalSpent, 0);

    res.json({
      categories: categories.map(c => ({
        category: c._id || 'UNCATEGORIZED',
        totalSpent: Math.round(c.totalSpent),
        transactionCount: c.transactionCount,
        percentOfTotal: grandTotal > 0 ? Math.round((c.totalSpent / grandTotal) * 100) : 0,
        avgTransactionSize: Math.round(c.avgTransactionSize),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/by-month
 */
router.get('/by-month', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ months: [] });

    const months = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: sessionIds }, normalizedDate: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$normalizedDate' } },
          totalIncome: { $sum: { $cond: [{ $gt: ['$normalizedAmount', 0] }, '$normalizedAmount', 0] } },
          totalExpense: { $sum: { $cond: [{ $lt: ['$normalizedAmount', 0] }, { $abs: '$normalizedAmount' }, 0] } },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    res.json({
      months: months.map(m => {
        const [year, month] = m._id.split('-');
        return {
          month: `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`,
          monthKey: m._id,
          totalIncome: Math.round(m.totalIncome),
          totalExpense: Math.round(m.totalExpense),
          netFlow: Math.round(m.totalIncome - m.totalExpense),
          transactionCount: m.transactionCount,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/by-merchant
 */
router.get('/by-merchant', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ merchants: [] });

    const merchants = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: sessionIds }, normalizedAmount: { $lt: 0 } } },
      {
        $group: {
          _id: '$merchantName',
          totalSpent: { $sum: { $abs: '$normalizedAmount' } },
          transactionCount: { $sum: 1 },
          avgAmount: { $avg: { $abs: '$normalizedAmount' } },
          category: { $first: '$category' },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 15 },
    ]);

    res.json({
      merchants: merchants.map(m => ({
        merchantName: m._id || 'UNKNOWN',
        totalSpent: Math.round(m.totalSpent),
        transactionCount: m.transactionCount,
        avgAmount: Math.round(m.avgAmount),
        category: m.category || 'UNCATEGORIZED',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/trends
 */
router.get('/trends', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ weeks: [] });

    const weeks = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: sessionIds }, normalizedDate: { $ne: null }, normalizedAmount: { $lt: 0 } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-W%V', date: '$normalizedDate' } },
          totalSpend: { $sum: { $abs: '$normalizedAmount' } },
          transactionCount: { $sum: 1 },
          weekStart: { $min: '$normalizedDate' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      weeks: weeks.map(w => ({
        weekLabel: w._id,
        totalSpend: Math.round(w.totalSpend),
        transactionCount: w.transactionCount,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// INVESTMENT ANALYTICS ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/analytics/portfolio-summary
 * Aggregates holdings data (groww_holdings / zerodha_holdings).
 */
router.get('/portfolio-summary', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ holdings: [], totalValue: 0, totalPnL: 0, totalInvested: 0 });

    // Only consider holdings sessions
    const holdingSessions = await Session.find({
      sessionId: { $in: sessionIds },
      userId: req.user.userId,
      fileType: { $in: ['groww_holdings', 'zerodha_holdings'] },
    }, { sessionId: 1 }).lean();

    const holdingIds = holdingSessions.map(s => s.sessionId);
    if (holdingIds.length === 0) return res.json({ holdings: [], totalValue: 0, totalPnL: 0, totalInvested: 0 });

    const holdings = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: holdingIds }, merchantName: { $ne: 'PORTFOLIO TOTAL' } } },
      {
        $group: {
          _id: '$symbol',
          currentValue: { $sum: '$normalizedAmount' },
          totalQty: { $sum: '$quantity' },
          avgPrice: { $avg: '$price' },
          pnl: { $sum: { $ifNull: ['$pnl', 0] } },
        },
      },
      { $sort: { currentValue: -1 } },
    ]);

    const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
    const totalPnL = holdings.reduce((s, h) => s + h.pnl, 0);
    const totalInvested = holdings.reduce((s, h) => s + (h.totalQty * h.avgPrice), 0);

    res.json({
      holdings: holdings.map(h => ({
        symbol: h._id || 'UNKNOWN',
        currentValue: Math.round(h.currentValue),
        quantity: h.totalQty,
        avgPrice: Math.round(h.avgPrice),
        pnl: Math.round(h.pnl),
        allocation: totalValue > 0 ? Math.round((h.currentValue / totalValue) * 100) : 0,
      })),
      totalValue: Math.round(totalValue),
      totalPnL: Math.round(totalPnL),
      totalInvested: Math.round(totalInvested),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/symbol-pnl
 * Aggregates trade/P&L data grouped by symbol
 * (groww_stocks, zerodha_tradebook, zerodha_pnl).
 */
router.get('/symbol-pnl', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ symbols: [], totalPnL: 0 });

    const tradeSessions = await Session.find({
      sessionId: { $in: sessionIds },
      userId: req.user.userId,
      fileType: { $in: ['groww_stocks', 'zerodha_tradebook', 'zerodha_pnl'] },
    }, { sessionId: 1, fileType: 1 }).lean();

    const tradeIds = tradeSessions.map(s => s.sessionId);
    if (tradeIds.length === 0) return res.json({ symbols: [], totalPnL: 0 });

    const symbols = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: tradeIds }, merchantName: { $nin: ['PORTFOLIO TOTAL', 'TOTAL REALIZED P&L', 'TOTAL UNREALIZED P&L', 'OVERALL NET P&L'] } } },
      {
        $group: {
          _id: '$symbol',
          totalBuyValue: { $sum: { $cond: [{ $eq: ['$direction', 'buy'] }, { $abs: '$normalizedAmount' }, 0] } },
          totalSellValue: { $sum: { $cond: [{ $eq: ['$direction', 'sell'] }, { $abs: '$normalizedAmount' }, 0] } },
          buyCount: { $sum: { $cond: [{ $eq: ['$direction', 'buy'] }, 1, 0] } },
          sellCount: { $sum: { $cond: [{ $eq: ['$direction', 'sell'] }, 1, 0] } },
          totalQty: { $sum: '$quantity' },
          pnl: { $sum: { $ifNull: ['$pnl', 0] } },
          tradeCount: { $sum: 1 },
        },
      },
      { $sort: { pnl: -1 } },
    ]);

    // For tradebook data where pnl is 0, compute from buy/sell values
    const enriched = symbols.map(s => {
      const computedPnL = s.pnl !== 0 ? s.pnl : (s.totalSellValue - s.totalBuyValue);
      return {
        symbol: s._id || 'UNKNOWN',
        totalBuyValue: Math.round(s.totalBuyValue),
        totalSellValue: Math.round(s.totalSellValue),
        buyCount: s.buyCount,
        sellCount: s.sellCount,
        tradeCount: s.tradeCount,
        pnl: Math.round(computedPnL),
      };
    });

    const totalPnL = enriched.reduce((s, e) => s + e.pnl, 0);

    res.json({ symbols: enriched, totalPnL });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/fund-performance
 * Aggregates mutual fund data grouped by Fund Name (groww_mf).
 */
router.get('/fund-performance', async (req, res) => {
  try {
    const sessionIds = await resolveSessionIds(req);
    if (sessionIds.length === 0) return res.json({ funds: [], totalInvested: 0, totalRedeemed: 0 });

    const mfSessions = await Session.find({
      sessionId: { $in: sessionIds },
      userId: req.user.userId,
      fileType: 'groww_mf',
    }, { sessionId: 1 }).lean();

    const mfIds = mfSessions.map(s => s.sessionId);
    if (mfIds.length === 0) return res.json({ funds: [], totalInvested: 0, totalRedeemed: 0 });

    const funds = await RawTransaction.aggregate([
      { $match: { sessionId: { $in: mfIds } } },
      {
        $group: {
          _id: '$merchantName',
          totalPurchased: { $sum: { $cond: [{ $eq: ['$direction', 'buy'] }, { $abs: '$normalizedAmount' }, 0] } },
          totalRedeemed: { $sum: { $cond: [{ $eq: ['$direction', 'sell'] }, { $abs: '$normalizedAmount' }, 0] } },
          totalUnits: { $sum: { $cond: [{ $eq: ['$direction', 'buy'] }, '$quantity', 0] } },
          txnCount: { $sum: 1 },
          latestNav: { $last: '$price' },
        },
      },
      { $sort: { totalPurchased: -1 } },
    ]);

    const totalInvested = funds.reduce((s, f) => s + f.totalPurchased, 0);
    const totalRedeemed = funds.reduce((s, f) => s + f.totalRedeemed, 0);

    res.json({
      funds: funds.map(f => ({
        fundName: f._id || 'UNKNOWN',
        totalPurchased: Math.round(f.totalPurchased),
        totalRedeemed: Math.round(f.totalRedeemed),
        netInvested: Math.round(f.totalPurchased - f.totalRedeemed),
        totalUnits: parseFloat(f.totalUnits?.toFixed(3) || '0'),
        txnCount: f.txnCount,
        latestNav: Math.round(f.latestNav || 0),
        allocation: totalInvested > 0 ? Math.round((f.totalPurchased / totalInvested) * 100) : 0,
      })),
      totalInvested: Math.round(totalInvested),
      totalRedeemed: Math.round(totalRedeemed),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
