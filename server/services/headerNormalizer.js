/**
 * Canonical field definitions — each key is a canonical field name,
 * and the value is an array of case-insensitive patterns to match
 * against raw CSV column headers.
 */
const CANONICAL_MAP = {
  date: [
    'transaction date', 'txn date', 'value date', 'trade date', 'date',
  ],
  description: [
    'narration', 'description', 'details', 'particulars', 'remarks',
  ],
  amount: [
    'amount (inr)', 'amount', 'net amount', 'txn amount',
  ],
  debit: [
    'withdrawal (inr)', 'withdrawal', 'debit', 'dr', 'debit amount',
  ],
  credit: [
    'deposit (inr)', 'deposit', 'credit', 'cr', 'credit amount',
  ],
  balance: [
    'closing balance', 'balance', 'bal', 'running balance',
  ],
  transactionType: [
    'transaction type', 'txn type', 'type',
  ],
  symbol: [
    'symbol', 'scrip', 'instrument', 'stock', 'ticker',
  ],
  quantity: [
    'qty', 'quantity', 'lots', 'units',
  ],
  price: [
    'trade price', 'price', 'avg price', 'average price',
  ],
  pnl: [
    'realized p&l', 'p&l', 'net p&l', 'profit', 'pnl',
  ],
};

/**
 * Maps raw CSV column headers to canonical field names using
 * case-insensitive fuzzy matching.
 *
 * @param {string[]} rawHeaders - The raw column names from the CSV file.
 * @returns {Object} A mapping where keys are canonical field names and
 *   values are the matching raw header string, or null if no match found.
 *
 * @example
 *   normalizeHeaders(['Date', 'Narration', 'Withdrawal (INR)', 'Deposit (INR)', 'Closing Balance'])
 *   // → { date: 'Date', description: 'Narration', amount: null,
 *   //      debit: 'Withdrawal (INR)', credit: 'Deposit (INR)',
 *   //      balance: 'Closing Balance', ... }
 */
export function normalizeHeaders(rawHeaders) {
  const result = {};

  for (const [canonical, patterns] of Object.entries(CANONICAL_MAP)) {
    let matched = null;

    for (const header of rawHeaders) {
      const normalizedHeader = header.trim().toLowerCase();

      for (const pattern of patterns) {
        if (normalizedHeader === pattern || normalizedHeader.includes(pattern)) {
          matched = header; // preserve original casing
          break;
        }
      }

      if (matched) break;
    }

    result[canonical] = matched;
  }

  return result;
}

/**
 * Detects the specific file format (e.g. broker export type) based on raw headers.
 * 
 * @param {string[]} rawHeaders - The raw column names from the CSV file.
 * @returns {string} The detected file type string.
 */
export function detectFileSource(rawHeaders) {
  const headers = rawHeaders.map(h => h.trim().toLowerCase());
  
  const has = (keyword) => headers.some(h => h.includes(keyword.toLowerCase()));

  // Groww Mutual Funds
  if (has('fund name') && has('nav') && has('folio')) {
    return 'groww_mf';
  }
  
  // Groww Stocks
  if (has('symbol') && has('brokerage') && has('segment')) {
    return 'groww_stocks';
  }
  
  // Groww Holdings
  if (has('symbol') && has('ltp') && has('p&l percentage')) {
    return 'groww_holdings';
  }
  
  // Zerodha Tradebook
  if (has('trade id') && has('order execution time')) {
    return 'zerodha_tradebook';
  }
  
  // Zerodha PnL
  if (has('realized p&l') && has('unrealized p&l') && has('opening quantity')) {
    return 'zerodha_pnl';
  }
  
  // Zerodha Holdings
  if (has('tradingsymbol') && has('t1 quantity') && has('authorised quantity')) {
    return 'zerodha_holdings';
  }
  
  // Zerodha Ledger
  if (has('particulars') && has('voucher number') && has('net')) {
    return 'zerodha_ledger';
  }
  
  // Existing detection (generic trading logs and bank statements)
  if (has('symbol') || has('pnl') || has('realized p&l') || has('p&l')) {
    return 'trading_log';
  }
  
  // Bank statement detection is the default fallback if generic fields like debit/credit/amount are present
  if (has('debit') || has('credit') || has('amount') || has('withdrawal') || has('deposit')) {
    return 'bank_statement';
  }

  return 'unknown';
}
