/**
 * Formats a Date into a human-readable string like "January 14, 2024".
 * @param {Date} date
 * @returns {string}
 */
function readableDate(date) {
  if (!date || isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats a number in Indian locale with ₹ prefix.
 * @param {number} amount
 * @returns {string}
 */
function formatINR(amount) {
  return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
}

/**
 * Returns a YYYY-MM-DD string for grouping by day.
 * @param {Date} date
 * @returns {string|null}
 */
function toDateKey(date) {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Returns a YYYY-MM string for grouping by month.
 * @param {Date} date
 * @returns {string|null}
 */
function toMonthKey(date) {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 7);
}

/**
 * Returns a human-readable "Month Year" string like "January 2024".
 * @param {string} monthKey - A YYYY-MM string.
 * @returns {string}
 */
function readableMonth(monthKey) {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
}

/**
 * Returns the top N most frequent items from an array.
 * @param {string[]} items
 * @param {number} n
 * @returns {string[]}
 */
function topN(items, n) {
  const freq = {};
  for (const item of items) {
    if (item) freq[item] = (freq[item] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
}

// ─── TYPE 1: Single-row chunks ────────────────────────────────

function buildSingleRowChunks(rows, sessionId, fileType) {
  return rows.map((row) => {
    let text;

    if (fileType === 'trading_log' || fileType === 'groww_stocks' || fileType === 'zerodha_tradebook') {
      text =
        `Trade on ${readableDate(row.normalizedDate)}: ${row.direction} ` +
        `${row.quantity ?? '?'} units of ${row.symbol || row.merchantName || 'N/A'} at ` +
        `${formatINR(row.price ?? 0)}. Net amount: ${formatINR(row.normalizedAmount)}. ` +
        `[Row ${row.rowIndex}]`;
    } else if (fileType === 'groww_mf') {
      const txnType = row.rawData?.['Transaction Type'] || row.direction;
      text =
        `Mutual fund ${txnType} on ${readableDate(row.normalizedDate)}: ` +
        `${row.merchantName || 'N/A'} — ${formatINR(row.normalizedAmount)}, ` +
        `${row.quantity ?? '?'} units at NAV ${formatINR(row.price ?? 0)}. ` +
        `[Row ${row.rowIndex}]`;
    } else if (fileType === 'groww_holdings' || fileType === 'zerodha_holdings') {
      text =
        `Holding: ${row.merchantName || 'N/A'} — ${row.quantity ?? '?'} units, ` +
        `current value ${formatINR(row.normalizedAmount)}, ` +
        `P&L: ${formatINR(row.pnl ?? 0)}. ` +
        `[Row ${row.rowIndex}]`;
    } else if (fileType === 'zerodha_pnl') {
      text =
        `P&L for ${row.merchantName || 'N/A'}: Net P&L ${formatINR(row.normalizedAmount)}. ` +
        `Realized: ${formatINR(parseFloat(row.rawData?.['Realized P&L']) || 0)}, ` +
        `Unrealized: ${formatINR(parseFloat(row.rawData?.['Unrealized P&L']) || 0)}. ` +
        `[Row ${row.rowIndex}]`;
    } else if (fileType === 'zerodha_ledger') {
      text =
        `Ledger entry on ${readableDate(row.normalizedDate)}: ` +
        `${row.direction} ${formatINR(row.normalizedAmount)} — ${row.merchantName || 'N/A'}. ` +
        `Category: ${row.category}. [Row ${row.rowIndex}]`;
    } else if (fileType === 'generic_document') {
      text = `${row.rawData.Description} [Row ${row.rowIndex}]`;
    } else {
      text =
        `On ${readableDate(row.normalizedDate)}, a ${row.direction} of ` +
        `${formatINR(row.normalizedAmount)} was recorded. ` +
        `Description: ${row.merchantName || 'N/A'}.` +
        (row.balance != null ? ` Post-transaction balance: ${formatINR(row.balance)}.` : '') +
        ` [Row ${row.rowIndex}]`;
    }

    return {
      sessionId,
      text,
      embedding: [],
      metadata: {
        rowIndexes: [row.rowIndex],
        dateRange: { start: row.normalizedDate, end: row.normalizedDate },
        categories: [row.category],
        totalAmount: row.normalizedAmount,
        chunkType: 'single_row',
      },
    };
  });
}

// ─── TYPE 2: Daily aggregate chunks ───────────────────────────

function buildDailyAggregateChunks(rows, sessionId) {
  const groups = {};
  for (const row of rows) {
    const key = toDateKey(row.normalizedDate);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  const chunks = [];
  for (const [dateKey, group] of Object.entries(groups)) {
    if (group.length < 2) continue;
    const date = group[0].normalizedDate;
    const sum = group.reduce((acc, r) => acc + r.normalizedAmount, 0);
    const rowIndexes = group.map((r) => r.rowIndex);
    const categories = [...new Set(group.map((r) => r.category))];
    const listing = group
      .map((r) => `${r.merchantName || 'N/A'} (${r.direction} ${formatINR(r.normalizedAmount)})`)
      .join('; ');
    const text =
      `On ${readableDate(date)} — ${group.length} transactions: ${listing}. ` +
      `Net for day: ${formatINR(sum)}. [Rows ${rowIndexes.join(', ')}]`;
    chunks.push({
      sessionId, text, embedding: [],
      metadata: { rowIndexes, dateRange: { start: date, end: date }, categories, totalAmount: sum, chunkType: 'daily_aggregate' },
    });
  }
  return chunks;
}

// ─── TYPE 3: Category aggregate chunks ────────────────────────

function buildCategoryAggregateChunks(rows, sessionId) {
  const groups = {};
  for (const row of rows) {
    const monthKey = toMonthKey(row.normalizedDate);
    if (!monthKey) continue;
    const compositeKey = `${monthKey}::${row.category}`;
    if (!groups[compositeKey]) groups[compositeKey] = { monthKey, category: row.category, rows: [] };
    groups[compositeKey].rows.push(row);
  }
  const chunks = [];
  for (const group of Object.values(groups)) {
    const { monthKey, category, rows: groupRows } = group;
    const sum = groupRows.reduce((acc, r) => acc + r.normalizedAmount, 0);
    const rowIndexes = groupRows.map((r) => r.rowIndex);
    const merchants = topN(groupRows.map((r) => r.merchantName), 3);
    const dates = groupRows.map((r) => r.normalizedDate).filter(Boolean).sort((a, b) => a - b);
    const text =
      `${readableMonth(monthKey)} — ${category}: ${groupRows.length} transactions ` +
      `totaling ${formatINR(sum)}. ` +
      `Top merchants: ${merchants.join(', ') || 'N/A'}. ` +
      `[Rows ${rowIndexes.join(', ')}]`;
    chunks.push({
      sessionId, text, embedding: [],
      metadata: { rowIndexes, dateRange: { start: dates[0] || null, end: dates[dates.length - 1] || null }, categories: [category], totalAmount: sum, chunkType: 'category_aggregate' },
    });
  }
  return chunks;
}

// ─── TYPE 4: Symbol aggregate (stocks/tradebook) ──────────────

function buildSymbolAggregateChunks(rows, sessionId) {
  const bySymbol = {};
  for (const r of rows) {
    const sym = r.symbol || r.merchantName;
    if (!sym || sym === 'PORTFOLIO TOTAL') continue;
    if (!bySymbol[sym]) bySymbol[sym] = [];
    bySymbol[sym].push(r);
  }
  const chunks = [];
  for (const [symbol, group] of Object.entries(bySymbol)) {
    const buys = group.filter(r => r.direction === 'buy');
    const sells = group.filter(r => r.direction === 'sell');
    const totalBuyQty = buys.reduce((s, r) => s + (r.quantity || 0), 0);
    const totalSellQty = sells.reduce((s, r) => s + (r.quantity || 0), 0);
    const totalBuyValue = buys.reduce((s, r) => s + Math.abs(r.normalizedAmount), 0);
    const totalSellValue = sells.reduce((s, r) => s + Math.abs(r.normalizedAmount), 0);
    const rowIndexes = group.map(r => r.rowIndex);
    const dates = group.map(r => r.normalizedDate).filter(Boolean).sort((a, b) => a - b);
    const text =
      `Stock: ${symbol}. Total trades: ${group.length}. ` +
      `Bought: ${totalBuyQty} units across ${buys.length} trades, total cost ${formatINR(totalBuyValue)}. ` +
      `Sold: ${totalSellQty} units across ${sells.length} trades, total proceeds ${formatINR(totalSellValue)}. ` +
      `Net quantity held: ${totalBuyQty - totalSellQty} units. ` +
      `Approximate P&L: ${formatINR(totalSellValue - totalBuyValue)}. ` +
      `[Rows ${rowIndexes.join(', ')}]`;
    chunks.push({
      sessionId, text, embedding: [],
      metadata: { rowIndexes, dateRange: { start: dates[0] || null, end: dates[dates.length - 1] || null }, categories: ['INVESTMENTS'], totalAmount: totalSellValue - totalBuyValue, chunkType: 'symbol_aggregate' },
    });
  }
  return chunks;
}

// ─── TYPE 5: Fund aggregate (groww_mf) ────────────────────────

function buildFundAggregateChunks(rows, sessionId) {
  const byFund = {};
  for (const r of rows) {
    const fund = r.rawData?.['Fund Name'] || r.merchantName;
    if (!fund) continue;
    if (!byFund[fund]) byFund[fund] = [];
    byFund[fund].push(r);
  }
  const chunks = [];
  for (const [fundName, group] of Object.entries(byFund)) {
    const purchases = group.filter(r => r.direction === 'buy');
    const redemptions = group.filter(r => r.direction === 'sell');
    const totalPurchased = purchases.reduce((s, r) => s + Math.abs(r.normalizedAmount), 0);
    const totalRedeemed = redemptions.reduce((s, r) => s + Math.abs(r.normalizedAmount), 0);
    const totalUnits = purchases.reduce((s, r) => s + (r.quantity || 0), 0);
    const sipCount = group.filter(r => (r.rawData?.['Transaction Type'] || '').toUpperCase() === 'SIP').length;
    const rowIndexes = group.map(r => r.rowIndex);
    const text =
      `Fund: ${fundName}. Total transactions: ${group.length}. ` +
      `Total purchased: ${formatINR(totalPurchased)} across ${purchases.length} transactions, total units: ${totalUnits.toFixed(3)}. ` +
      `Total redeemed: ${formatINR(totalRedeemed)} across ${redemptions.length} transactions. ` +
      `Net invested: ${formatINR(totalPurchased - totalRedeemed)}. ` +
      `SIP transactions: ${sipCount}. ` +
      `[Rows ${rowIndexes.join(', ')}]`;
    chunks.push({
      sessionId, text, embedding: [],
      metadata: { rowIndexes, dateRange: { start: null, end: null }, categories: ['INVESTMENTS'], totalAmount: totalPurchased - totalRedeemed, chunkType: 'fund_aggregate' },
    });
  }
  return chunks;
}

// ─── TYPE 6: Portfolio summary (holdings) ─────────────────────

function buildPortfolioSummaryChunk(rows, sessionId) {
  const realRows = rows.filter(r => r.merchantName !== 'PORTFOLIO TOTAL');
  if (realRows.length === 0) return [];
  const totalValue = realRows.reduce((s, r) => s + r.normalizedAmount, 0);
  const totalPnL = realRows.reduce((s, r) => s + (r.pnl || 0), 0);
  const totalInvested = realRows.reduce((s, r) => s + ((r.quantity || 0) * (r.price || 0)), 0);
  const pnlPercent = totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : '0';
  const profitable = realRows.filter(r => (r.pnl || 0) > 0);
  const lossMaking = realRows.filter(r => (r.pnl || 0) < 0);
  const top5 = [...realRows].sort((a, b) => b.normalizedAmount - a.normalizedAmount).slice(0, 5);
  const topGainers = [...realRows].filter(r => r.pnl > 0).sort((a, b) => {
    const aP = (a.price && a.quantity) ? (a.pnl / (a.price * a.quantity) * 100) : 0;
    const bP = (b.price && b.quantity) ? (b.pnl / (b.price * b.quantity) * 100) : 0;
    return bP - aP;
  }).slice(0, 2);
  const topLosers = [...realRows].filter(r => r.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 2);
  const rowIndexes = realRows.map(r => r.rowIndex);

  const text =
    `Portfolio snapshot as of ${readableDate(new Date())}. ` +
    `Total holdings: ${realRows.length} stocks/funds. ` +
    `Total current value: ${formatINR(totalValue)}. ` +
    `Total P&L: ${formatINR(totalPnL)} (${pnlPercent}%). ` +
    `Profitable positions: ${profitable.length}. Loss-making positions: ${lossMaking.length}. ` +
    `Top 5 holdings by value: ${top5.map(r => `${r.merchantName} (${formatINR(r.normalizedAmount)})`).join(', ')}. ` +
    `Top gainers: ${topGainers.map(r => r.merchantName).join(', ') || 'None'}. ` +
    `Top losers: ${topLosers.map(r => r.merchantName).join(', ') || 'None'}. ` +
    `[Rows ${rowIndexes.join(', ')}]`;

  return [{
    sessionId, text, embedding: [],
    metadata: { rowIndexes, dateRange: { start: new Date(), end: new Date() }, categories: ['INVESTMENTS'], totalAmount: totalValue, chunkType: 'portfolio_summary' },
  }];
}

// ─── TYPE 7: PnL summary (zerodha_pnl) ───────────────────────

function buildPnLSummaryChunk(rows, sessionId) {
  const realRows = rows.filter(r => r.rowIndex < 9000);
  if (realRows.length === 0) return [];
  const totalRealized = realRows.reduce((s, r) => s + (parseFloat(r.rawData?.['Realized P&L']) || 0), 0);
  const totalUnrealized = realRows.reduce((s, r) => s + (parseFloat(r.rawData?.['Unrealized P&L']) || 0), 0);
  const netPnL = totalRealized + totalUnrealized;
  const profitable = realRows.filter(r => r.normalizedAmount > 0);
  const lossMaking = realRows.filter(r => r.normalizedAmount < 0);
  const best = [...realRows].sort((a, b) => b.normalizedAmount - a.normalizedAmount)[0];
  const worst = [...realRows].sort((a, b) => a.normalizedAmount - b.normalizedAmount)[0];
  const rowIndexes = realRows.map(r => r.rowIndex);

  const text =
    `P&L summary for period. ` +
    `Total realized P&L: ${formatINR(totalRealized)}. ` +
    `Total unrealized P&L: ${formatINR(totalUnrealized)}. ` +
    `Net P&L: ${formatINR(netPnL)}. ` +
    `Profitable symbols: ${profitable.length} (${profitable.slice(0, 3).map(r => r.merchantName).join(', ')}). ` +
    `Loss-making symbols: ${lossMaking.length} (${lossMaking.slice(0, 3).map(r => r.merchantName).join(', ')}). ` +
    `Best performer: ${best?.merchantName || 'N/A'} with ${formatINR(best?.normalizedAmount || 0)} profit. ` +
    `Worst performer: ${worst?.merchantName || 'N/A'} with ${formatINR(worst?.normalizedAmount || 0)} loss. ` +
    `[Rows ${rowIndexes.join(', ')}]`;

  return [{
    sessionId, text, embedding: [],
    metadata: { rowIndexes, dateRange: { start: new Date(), end: new Date() }, categories: ['INVESTMENTS'], totalAmount: netPnL, chunkType: 'pnl_summary' },
  }];
}

// ─── Main export ──────────────────────────────────────────────

/**
 * Builds chunk documents from normalized CSV rows.
 *
 * @param {Object[]} normalizedRows - Rows from parseCSV().
 * @param {string} sessionId - The session identifier.
 * @param {string} [fileType='bank_statement'] - The detected file type.
 * @returns {Object[]} Flat array of chunk documents ready for Chunk.insertMany().
 */
export function buildChunks(normalizedRows, sessionId, fileType = 'bank_statement') {
  const singleRow = buildSingleRowChunks(normalizedRows, sessionId, fileType);
  const dailyAgg = buildDailyAggregateChunks(normalizedRows, sessionId);
  const categoryAgg = buildCategoryAggregateChunks(normalizedRows, sessionId);

  const investmentChunks = [];

  if (fileType === 'groww_stocks' || fileType === 'zerodha_tradebook') {
    investmentChunks.push(...buildSymbolAggregateChunks(normalizedRows, sessionId));
  }

  if (fileType === 'groww_mf') {
    investmentChunks.push(...buildFundAggregateChunks(normalizedRows, sessionId));
  }

  if (fileType === 'groww_holdings' || fileType === 'zerodha_holdings') {
    investmentChunks.push(...buildPortfolioSummaryChunk(normalizedRows, sessionId));
  }

  if (fileType === 'zerodha_pnl') {
    investmentChunks.push(...buildPnLSummaryChunk(normalizedRows, sessionId));
  }

  return [...singleRow, ...dailyAgg, ...categoryAgg, ...investmentChunks];
}
