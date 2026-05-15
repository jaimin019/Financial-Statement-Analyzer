import Papa from 'papaparse';
import { normalizeHeaders, detectFileSource } from './headerNormalizer.js';

// ── Keyword-based category tagger ───────────────────────────
const CATEGORY_RULES = [
  { category: 'FOOD_DELIVERY',  keywords: ['swiggy', 'zomato', 'zepto', 'blinkit', 'dunzo', 'magicpin'] },
  { category: 'GROCERIES',      keywords: ['bigbasket', 'dmart', 'reliance smart', 'more supermarket'] },
  { category: 'FUEL',           keywords: ['petrol', 'diesel', 'hpcl', 'bpcl', 'iocl', 'indian oil', 'hp pump'] },
  { category: 'ENTERTAINMENT',  keywords: ['netflix', 'amazon prime', 'hotstar', 'spotify', 'youtube'] },
  { category: 'INVESTMENTS',    keywords: ['zerodha', 'groww', 'mf', 'mutual fund', 'sip', 'nps'] },
  { category: 'SALARY',         keywords: ['salary', 'payroll', 'payslip', 'stipend'] },
  { category: 'UTILITIES',      keywords: ['electricity', 'water', 'broadband', 'airtel', 'jio', 'bsnl'] },
  { category: 'HEALTHCARE',     keywords: ['pharmacy', 'hospital', 'clinic', 'apollo', 'practo', 'netmeds'] },
  { category: 'SHOPPING',       keywords: ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio'] },
];

function categorize(merchantName) {
  if (!merchantName) return 'UNCATEGORIZED';
  const lower = merchantName.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) return rule.category;
    }
  }
  return 'UNCATEGORIZED';
}

function extractMerchant(raw) {
  if (!raw) return '';
  let cleaned = raw;
  cleaned = cleaned.replace(/^(UPI\/|NEFT[-\/]|IMPS[-\/]|RTGS[-\/]|ACH[-\/]|MMT\/|BIL\/|Payment to\s+|Transfer to\s+|Paid to\s+)/i, '');
  cleaned = cleaned.replace(/\d{8,}/g, '');
  cleaned = cleaned.replace(/\b(REF|TXN|UTR)\d*/gi, '');
  cleaned = cleaned.replace(/\d{2}[-\/]\d{2}[-\/]\d{2,4}/g, '');
  const segments = cleaned.split(/[\/|]/).map(s => s.trim()).filter(Boolean);
  let result = '';
  for (const seg of segments) {
    const stripped = seg.replace(/[-\s]/g, '');
    if (stripped.length >= 3 && !/^\d+$/.test(stripped)) { result = seg; break; }
  }
  if (!result) {
    const dashSegments = cleaned.split('-').map(s => s.trim()).filter(Boolean);
    for (const seg of dashSegments) {
      const stripped = seg.replace(/\s/g, '');
      if (stripped.length >= 3 && !/^\d+$/.test(stripped)) { result = seg; break; }
    }
  }
  result = result.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!result || result.length < 3 || /^\d+$/.test(result)) {
    result = raw.replace(/\d{8,}/g, '').trim().toUpperCase();
  }
  return result.slice(0, 40).trim();
}

// ── Shared helpers ──────────────────────────────────────────
function parseNum(val) {
  if (val == null || val === '') return NaN;
  return parseFloat(String(val).replace(/[₹,\s]/g, ''));
}

function findCol(row, ...candidates) {
  for (const c of candidates) {
    const keys = Object.keys(row);
    const match = keys.find(k => k.trim().toLowerCase() === c.toLowerCase());
    if (match && row[match] != null && row[match] !== '') return row[match];
  }
  return undefined;
}

/** Parse DD-MMM-YYYY (e.g. 15-Jan-2024), DD-MM-YYYY, YYYY-MM-DD, and standard Date formats */
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // DD-MMM-YYYY
  const mmmMatch = s.match(/^(\d{1,2})[-\/](\w{3})[-\/](\d{4})$/);
  if (mmmMatch) {
    const d = new Date(`${mmmMatch[2]} ${mmmMatch[1]}, ${mmmMatch[3]}`);
    if (!isNaN(d.getTime())) return d;
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function rawDataMap(row) {
  const m = {};
  for (const [k, v] of Object.entries(row)) { if (v != null && v !== '') m[k] = String(v); }
  return m;
}

// ═══════════════════════════════════════════════════════════
// GROWW NORMALIZERS
// ═══════════════════════════════════════════════════════════

function normalizeGrowwMF(data) {
  let skipped = 0;
  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const status = (findCol(r, 'Status') || '').toUpperCase();
    if (status && status !== 'SUCCESSFUL') { skipped++; continue; }
    const txnType = (findCol(r, 'Transaction Type') || '').toUpperCase();
    const isOutflow = txnType === 'REDEMPTION' || txnType === 'SWITCH_OUT';
    const amount = parseNum(findCol(r, 'Amount'));
    rows.push({
      rowIndex: rows.length + 1,
      rawData: rawDataMap(r),
      normalizedDate: parseDate(findCol(r, 'Transaction Date')),
      normalizedAmount: isNaN(amount) ? 0 : (isOutflow ? -Math.abs(amount) : Math.abs(amount)),
      direction: isOutflow ? 'sell' : 'buy',
      merchantName: (findCol(r, 'Scheme Name') || findCol(r, 'Fund Name') || '').slice(0, 60),
      category: 'INVESTMENTS',
      balance: null, symbol: null, quantity: parseNum(findCol(r, 'Units')),
      price: parseNum(findCol(r, 'NAV')), pnl: null,
    });
  }
  if (process.env.NODE_ENV === 'development' && skipped > 0) {
    console.log(`ℹ️  Groww MF: skipped ${skipped} non-SUCCESSFUL rows`);
  }
  return rows;
}

function normalizeGrowwStocks(data) {
  return data.map((r, i) => {
    const tradeType = (findCol(r, 'Trade Type') || '').toUpperCase();
    const netAmt = parseNum(findCol(r, 'Net Amount'));
    const isBuy = tradeType === 'BUY';
    return {
      rowIndex: i + 1, rawData: rawDataMap(r),
      normalizedDate: parseDate(findCol(r, 'Trade Date')),
      normalizedAmount: isNaN(netAmt) ? 0 : (isBuy ? -Math.abs(netAmt) : Math.abs(netAmt)),
      direction: isBuy ? 'buy' : 'sell',
      merchantName: findCol(r, 'Symbol') || '',
      category: 'INVESTMENTS',
      balance: null, symbol: findCol(r, 'Symbol'),
      quantity: parseNum(findCol(r, 'Quantity')),
      price: parseNum(findCol(r, 'Price')), pnl: null,
    };
  });
}

function normalizeGrowwHoldings(data) {
  const now = new Date();
  const rows = data.map((r, i) => {
    const curVal = parseNum(findCol(r, 'Current Value'));
    return {
      rowIndex: i + 1, rawData: rawDataMap(r),
      normalizedDate: now,
      normalizedAmount: isNaN(curVal) ? 0 : Math.abs(curVal),
      direction: 'credit',
      merchantName: findCol(r, 'Symbol') || '',
      category: 'INVESTMENTS',
      balance: null, symbol: findCol(r, 'Symbol'),
      quantity: parseNum(findCol(r, 'Quantity')),
      price: parseNum(findCol(r, 'Average Price')),
      pnl: parseNum(findCol(r, 'P&L')),
    };
  });
  // Synthetic PORTFOLIO TOTAL row
  const totalValue = rows.reduce((s, r) => s + r.normalizedAmount, 0);
  const totalPnL = rows.reduce((s, r) => s + (isNaN(r.pnl) ? 0 : r.pnl), 0);
  const totalInvested = rows.reduce((s, r) => s + ((isNaN(r.quantity) ? 0 : r.quantity) * (isNaN(r.price) ? 0 : r.price)), 0);
  rows.push({
    rowIndex: 9000, rawData: { 'Portfolio Total': 'true', 'Total Value': String(totalValue), 'Total P&L': String(totalPnL), 'Total Invested': String(totalInvested), 'Holdings Count': String(data.length) },
    normalizedDate: now, normalizedAmount: totalValue, direction: 'credit',
    merchantName: 'PORTFOLIO TOTAL', category: 'INVESTMENTS',
    balance: null, symbol: null, quantity: null, price: null, pnl: totalPnL,
  });
  return rows;
}

// ═══════════════════════════════════════════════════════════
// ZERODHA NORMALIZERS
// ═══════════════════════════════════════════════════════════

function normalizeZerodhaTradeBook(data) {
  const rows = data.map((r, i) => {
    const tradeType = (findCol(r, 'Trade Type') || '').toUpperCase();
    const qty = parseNum(findCol(r, 'Quantity'));
    const price = parseNum(findCol(r, 'Price'));
    const value = (!isNaN(qty) && !isNaN(price)) ? qty * price : 0;
    const isBuy = tradeType === 'BUY';
    return {
      rowIndex: i + 1, rawData: rawDataMap(r),
      normalizedDate: parseDate(findCol(r, 'Trade Date')),
      normalizedAmount: isBuy ? -Math.abs(value) : Math.abs(value),
      direction: isBuy ? 'buy' : 'sell',
      merchantName: findCol(r, 'Symbol') || '',
      category: 'INVESTMENTS',
      balance: null, symbol: findCol(r, 'Symbol'),
      quantity: qty, price, pnl: null,
    };
  });
  // Group trade pairs for tradeNote
  const bySymbolDate = {};
  for (const row of rows) {
    const key = `${row.merchantName}::${row.normalizedDate?.toISOString()?.slice(0, 10) || ''}`;
    if (!bySymbolDate[key]) bySymbolDate[key] = [];
    bySymbolDate[key].push(row);
  }
  for (const group of Object.values(bySymbolDate)) {
    const buys = group.filter(r => r.direction === 'buy');
    const sells = group.filter(r => r.direction === 'sell');
    if (buys.length > 0 && sells.length > 0) {
      const buyVal = buys.reduce((s, r) => s + Math.abs(r.normalizedAmount), 0);
      const sellVal = sells.reduce((s, r) => s + Math.abs(r.normalizedAmount), 0);
      const note = `BUY ${buys.reduce((s,r)=>s+(r.quantity||0),0)} at avg ₹${(buyVal/buys.reduce((s,r)=>s+(r.quantity||0),0)).toFixed(2)}, SELL ${sells.reduce((s,r)=>s+(r.quantity||0),0)} at avg ₹${(sellVal/sells.reduce((s,r)=>s+(r.quantity||0),0)).toFixed(2)}, P&L: ₹${(sellVal - buyVal).toFixed(2)}`;
      for (const r of group) r.rawData.tradeNote = note;
    }
  }
  return rows;
}

function normalizeZerodhaPnL(data) {
  const now = new Date();
  const rows = data.map((r, i) => {
    const netPnL = parseNum(findCol(r, 'Net P&L'));
    return {
      rowIndex: i + 1, rawData: rawDataMap(r),
      normalizedDate: now,
      normalizedAmount: isNaN(netPnL) ? 0 : netPnL,
      direction: netPnL >= 0 ? 'credit' : 'debit',
      merchantName: findCol(r, 'Symbol') || '',
      category: 'INVESTMENTS',
      balance: null, symbol: findCol(r, 'Symbol'),
      quantity: null, price: null, pnl: netPnL,
    };
  });
  // Synthetic summary rows
  const totalRealized = rows.reduce((s, r) => s + (parseNum(r.rawData['Realized P&L']) || 0), 0);
  const totalUnrealized = rows.reduce((s, r) => s + (parseNum(r.rawData['Unrealized P&L']) || 0), 0);
  const totalNet = totalRealized + totalUnrealized;
  const makeSummary = (idx, name, val) => ({
    rowIndex: idx, rawData: { Summary: 'true', Type: name, Value: String(val) },
    normalizedDate: now, normalizedAmount: val, direction: val >= 0 ? 'credit' : 'debit',
    merchantName: name, category: 'INVESTMENTS',
    balance: null, symbol: null, quantity: null, price: null, pnl: val,
  });
  rows.push(makeSummary(9000, 'TOTAL REALIZED P&L', totalRealized));
  rows.push(makeSummary(9001, 'TOTAL UNREALIZED P&L', totalUnrealized));
  rows.push(makeSummary(9002, 'OVERALL NET P&L', totalNet));
  return rows;
}

function normalizeZerodhaLedger(data) {
  return data.map((r, i) => {
    const debit = parseNum(findCol(r, 'Debit'));
    const credit = parseNum(findCol(r, 'Credit'));
    let amount = 0, direction = 'unknown';
    if (!isNaN(credit) && credit > 0) { amount = credit; direction = 'credit'; }
    else if (!isNaN(debit) && debit > 0) { amount = -debit; direction = 'debit'; }
    const particulars = findCol(r, 'Particulars') || '';
    let merchantName = particulars.slice(0, 50).trim();
    if (/opening balance/i.test(particulars)) merchantName = 'OPENING BALANCE';
    else if (/journal/i.test(particulars)) merchantName = 'JOURNAL ENTRY';
    let category = 'INVESTMENTS';
    if (/settlement|payout/i.test(particulars)) category = 'INVESTMENTS';
    else if (/charges|tax|gst|stt|stamp/i.test(particulars)) category = 'FEES';
    else if (/opening|closing/i.test(particulars)) category = 'BALANCE';
    return {
      rowIndex: i + 1, rawData: rawDataMap(r),
      normalizedDate: parseDate(findCol(r, 'Date')),
      normalizedAmount: amount, direction, merchantName, category,
      balance: parseNum(findCol(r, 'Net')),
      symbol: null, quantity: null, price: null, pnl: null,
    };
  });
}

function normalizeZerodhaHoldings(data) {
  const now = new Date();
  const rows = data.map((r, i) => {
    const curVal = parseNum(findCol(r, 'Current Value'));
    return {
      rowIndex: i + 1, rawData: rawDataMap(r),
      normalizedDate: now,
      normalizedAmount: isNaN(curVal) ? 0 : Math.abs(curVal),
      direction: 'credit',
      merchantName: findCol(r, 'Tradingsymbol') || '',
      category: 'INVESTMENTS',
      balance: null, symbol: findCol(r, 'Tradingsymbol'),
      quantity: parseNum(findCol(r, 'Realised Quantity') || findCol(r, 'Opening Quantity')),
      price: parseNum(findCol(r, 'Average Price')),
      pnl: parseNum(findCol(r, 'P&L')),
    };
  });
  const totalValue = rows.reduce((s, r) => s + r.normalizedAmount, 0);
  const totalPnL = rows.reduce((s, r) => s + (isNaN(r.pnl) ? 0 : r.pnl), 0);
  const totalInvested = rows.reduce((s, r) => s + ((isNaN(r.quantity) ? 0 : r.quantity) * (isNaN(r.price) ? 0 : r.price)), 0);
  rows.push({
    rowIndex: 9000, rawData: { 'Portfolio Total': 'true', 'Total Value': String(totalValue), 'Total P&L': String(totalPnL), 'Total Invested': String(totalInvested), 'Holdings Count': String(data.length) },
    normalizedDate: now, normalizedAmount: totalValue, direction: 'credit',
    merchantName: 'PORTFOLIO TOTAL', category: 'INVESTMENTS',
    balance: null, symbol: null, quantity: null, price: null, pnl: totalPnL,
  });
  return rows;
}

// ═══════════════════════════════════════════════════════════
// BANK STATEMENT (original normalizer preserved)
// ═══════════════════════════════════════════════════════════

function normalizeBankOrTrading(data, headerMap, fileType) {
  return data.map((row, idx) => {
    const rowIndex = idx + 1;
    const rawData = { ...row };
    let normalizedDate = null;
    if (headerMap.date && row[headerMap.date]) {
      normalizedDate = parseDate(row[headerMap.date]);
    }
    let normalizedAmount = 0, direction = 'unknown';
    if (fileType === 'bank_statement') {
      const debitVal = headerMap.debit ? parseFloat(row[headerMap.debit]) : NaN;
      const creditVal = headerMap.credit ? parseFloat(row[headerMap.credit]) : NaN;
      const amountVal = headerMap.amount ? parseFloat(row[headerMap.amount]) : NaN;
      if (!isNaN(debitVal) && debitVal > 0) { normalizedAmount = -Math.abs(debitVal); direction = 'debit'; }
      else if (!isNaN(creditVal) && creditVal > 0) { normalizedAmount = Math.abs(creditVal); direction = 'credit'; }
      else if (!isNaN(amountVal)) { normalizedAmount = amountVal; direction = amountVal < 0 ? 'debit' : amountVal > 0 ? 'credit' : 'unknown'; }
    } else {
      const pnlVal = headerMap.pnl ? parseFloat(row[headerMap.pnl]) : NaN;
      normalizedAmount = isNaN(pnlVal) ? 0 : pnlVal;
      const txnType = headerMap.transactionType ? row[headerMap.transactionType]?.toLowerCase() : '';
      if (txnType.includes('buy')) direction = 'buy';
      else if (txnType.includes('sell')) direction = 'sell';
      else direction = normalizedAmount >= 0 ? 'sell' : 'buy';
    }
    const descriptionRaw = headerMap.description ? row[headerMap.description] : '';
    const merchantName = extractMerchant(descriptionRaw);
    const category = categorize(merchantName);
    return {
      rowIndex, rawData, normalizedDate, normalizedAmount, direction, merchantName, category,
      balance: headerMap.balance ? parseFloat(row[headerMap.balance]) : null,
      symbol: headerMap.symbol ? row[headerMap.symbol] : null,
      quantity: headerMap.quantity ? parseFloat(row[headerMap.quantity]) : null,
      price: headerMap.price ? parseFloat(row[headerMap.price]) : null,
      pnl: headerMap.pnl ? parseFloat(row[headerMap.pnl]) : null,
    };
  });
}

// ═══════════════════════════════════════════════════════════
// MAIN PARSER
// ═══════════════════════════════════════════════════════════

export function parseCSV(buffer) {
  const csvString = buffer.toString('utf-8');
  const { data, meta, errors } = Papa.parse(csvString, {
    header: true, skipEmptyLines: true, dynamicTyping: false,
  });
  if (errors.length > 0) console.warn('⚠️  Papaparse warnings:', errors);

  const headerMap = normalizeHeaders(meta.fields);
  const fileType = detectFileSource(meta.fields);

  let rows;
  switch (fileType) {
    case 'groww_mf':            rows = normalizeGrowwMF(data); break;
    case 'groww_stocks':        rows = normalizeGrowwStocks(data); break;
    case 'groww_holdings':      rows = normalizeGrowwHoldings(data); break;
    case 'zerodha_tradebook':   rows = normalizeZerodhaTradeBook(data); break;
    case 'zerodha_pnl':         rows = normalizeZerodhaPnL(data); break;
    case 'zerodha_ledger':      rows = normalizeZerodhaLedger(data); break;
    case 'zerodha_holdings':    rows = normalizeZerodhaHoldings(data); break;
    case 'trading_log':         rows = normalizeBankOrTrading(data, headerMap, 'trading_log'); break;
    default:                    rows = normalizeBankOrTrading(data, headerMap, 'bank_statement'); break;
  }

  return { rows, headerMap, fileType: fileType === 'unknown' ? 'bank_statement' : fileType };
}
