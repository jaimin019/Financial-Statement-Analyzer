import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { normalizeHeaders } from './headerNormalizer.js';

// Keyword-based category tagger copied from csvParser for consistency
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
    if (stripped.length >= 3 && !/^\d+$/.test(stripped)) {
      result = seg;
      break;
    }
  }
  
  if (!result) {
    const dashSegments = cleaned.split('-').map(s => s.trim()).filter(Boolean);
    for (const seg of dashSegments) {
      const stripped = seg.replace(/\s/g, '');
      if (stripped.length >= 3 && !/^\d+$/.test(stripped)) {
        result = seg;
        break;
      }
    }
  }
  
  result = result.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!result || result.length < 3 || /^\d+$/.test(result)) {
    result = raw.replace(/\d{8,}/g, '').trim().toUpperCase();
  }
  return result.slice(0, 40).trim();
}

/**
 * Parses a PDF buffer into normalized rows.
 */
export async function parsePDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  
  if (process.env.NODE_ENV === 'development') {
    console.log("--- PDF RAW TEXT EXTRACTED (first 500 chars) ---");
    console.log(text.substring(0, 500));
    console.log("------------------------------------------------");
  }

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length >= 10);
  
  // Detect format
  let format = 'generic';
  const headerLines = lines.slice(0, 50).join(' ').toUpperCase();
  if (headerLines.includes('HDFC')) format = 'hdfc';
  else if (headerLines.includes('ICICI')) format = 'icici';
  else if (headerLines.includes('STATE BANK OF INDIA') || headerLines.includes('SBI')) format = 'sbi';
  else if (headerLines.includes('AXIS BANK') || headerLines.includes('AXIS')) format = 'axis';
  else if (headerLines.includes('KOTAK')) format = 'kotak';
  
// Do not aggressively reject trading logs because it can falsely reject bank statements containing the word TRADE

  // Regex matches Date(DD/MM/YYYY or DD-MM-YYYY or DD MMM YYYY) ... Description ... Amount (digits with commas/decimals)
  // We'll use a very forgiving universal regex to capture:
  // ^(date) (description) (amounts at the end)
  const rows = [];
  let syntheticHeaders = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const headerMap = normalizeHeaders(syntheticHeaders);

  const txnRegex = /^(\d{2}[-\/\s]\w{2,3}[-\/\s]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?(?:\s+([\d,]+\.\d{2}))?$/;
  // Let's refine it: it might have Dr/Cr suffix
  const alternateRegex = /^(\d{2}[-\/\s]\w{2,3}[-\/\s]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2}\s*(?:Cr|Dr)?)\s*([\d,]+\.\d{2}\s*(?:Cr|Dr)?)?$/;

  let rowIndexCounter = 1;
  for (const line of lines) {
    let dateStr, desc, debitStr = '', creditStr = '', balanceStr = '';
    
    const match = line.match(txnRegex);
    const altMatch = line.match(alternateRegex);
    
    if (match) {
      dateStr = match[1];
      desc = match[2].trim();
      const num1 = match[3];
      const num2 = match[4];
      const num3 = match[5];
      
      // If we have 3 numbers, assume Debit, Credit, Balance
      if (num1 && num2 && num3) {
        // usually it's Debit Credit Balance, but sometimes one is empty. 
        // We'll try a simpler generic matching first
        // If the regex has exactly 3 numbers, we'll try to put it in Debit / Credit / Balance based on position
        // Actually, pdf line splitting often crushes multiple empty columns into single spaces.
        // Let's just try to extract the amounts.
        // It's hard to distinguish debit and credit without column positions.
        // For Week 9, we'll do a simple heuristic: if there are 3 numbers, it's Debit, Credit, Balance.
        // If there's 2 numbers, it might be Amount and Balance.
      }
    }
  }

  // A more robust regex:
  // Date: (\d{2}[-\/]\d{2}[-\/]\d{2,4}|\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})
  const dateRegexPart = '(\\d{2}[-/]\\d{2}[-/]\\d{2,4}|\\d{2}\\s+[A-Za-z]{3}\\s+\\d{2,4})';
  const amountRegexPart = '([\\d,]+\\.\\d{2})';
  
  // We'll build a custom parser for each line
  for (const line of lines) {
    // skip non-transaction lines early
    if (!line.match(/\d{2}[-/ ]/)) continue;
    
    const dateMatch = line.match(new RegExp(`^${dateRegexPart}`));
    if (!dateMatch) continue;
    
    const dateStr = dateMatch[1];
    let remaining = line.substring(dateMatch[0].length).trim();
    
    // Find all amounts in the line
    const amounts = [];
    const amountRegex = /[\d,]+\.\d{2}(?:\s*(?:Cr|Dr|CR|DR))?/g;
    let match;
    let lastIndex = 0;
    while ((match = amountRegex.exec(remaining)) !== null) {
      amounts.push({
        val: match[0],
        index: match.index
      });
      lastIndex = match.index + match[0].length;
    }
    
    if (amounts.length === 0) continue;
    
    // The description is everything between date and the first amount
    const firstAmountIndex = amounts[0].index;
    const desc = remaining.substring(0, firstAmountIndex).trim();
    
    let debit = '', credit = '', balance = '';
    
    // Determine debit/credit
    if (amounts.length === 1) {
      // Single amount - check for Dr/Cr
      const val = amounts[0].val;
      if (val.toUpperCase().includes('CR')) credit = val.replace(/[a-zA-Z\s,]/g, '');
      else if (val.toUpperCase().includes('DR')) debit = val.replace(/[a-zA-Z\s,]/g, '');
      else debit = val.replace(/[,]/g, ''); // Default to debit
    } else if (amounts.length >= 2) {
      // Usually the last amount is balance.
      balance = amounts[amounts.length - 1].val.replace(/[a-zA-Z\s,]/g, '');
      
      const val1 = amounts[0].val;
      // If there's 3 amounts, it's usually Debit, Credit, Balance
      if (amounts.length >= 3) {
        const val2 = amounts[1].val;
        if (val1 !== '0.00' && val1 !== '0') debit = val1.replace(/[,]/g, '');
        if (val2 !== '0.00' && val2 !== '0') credit = val2.replace(/[,]/g, '');
      } else {
        // 2 amounts: one is transaction, one is balance
        if (val1.toUpperCase().includes('CR')) credit = val1.replace(/[a-zA-Z\s,]/g, '');
        else if (val1.toUpperCase().includes('DR')) debit = val1.replace(/[a-zA-Z\s,]/g, '');
        else debit = val1.replace(/[,]/g, ''); 
      }
    }
    
    // Create row object similar to rawData in csvParser
    const rawData = {
      Date: dateStr,
      Description: desc,
      Debit: debit,
      Credit: credit,
      Balance: balance
    };
    
    // Normalize date
    let normalizedDate = null;
    const parsedDate = new Date(dateStr.replace(/-/g, '/')); // simple parse
    if (!isNaN(parsedDate.getTime())) normalizedDate = parsedDate;
    
    // Normalize amounts
    const debitVal = parseFloat(debit);
    const creditVal = parseFloat(credit);
    let normalizedAmount = 0;
    let direction = 'unknown';
    if (!isNaN(debitVal) && debitVal > 0) {
      normalizedAmount = -Math.abs(debitVal);
      direction = 'debit';
    } else if (!isNaN(creditVal) && creditVal > 0) {
      normalizedAmount = Math.abs(creditVal);
      direction = 'credit';
    }
    
    const merchantName = extractMerchant(desc);
    const category = categorize(merchantName);
    
    rows.push({
      rowIndex: rowIndexCounter++,
      rawData,
      normalizedDate,
      normalizedAmount,
      direction,
      merchantName,
      category,
      balance: parseFloat(balance) || null,
      symbol: null,
      quantity: null,
      price: null,
      pnl: null,
    });
  }

  if (rows.length < 2) {
    // Graceful fallback: Treat the PDF as a generic text document instead of a bank statement
    let rowIndexCounter = 1;
    for (let i = 0; i < lines.length; i += 5) { // Group lines into chunks of 5 for better context
      const chunkLines = lines.slice(i, i + 5).join(' ');
      if (chunkLines.trim().length < 10) continue;
      
      rows.push({
        rowIndex: rowIndexCounter++,
        rawData: {
          Date: '',
          Description: chunkLines.substring(0, 1000),
          Debit: '',
          Credit: '',
          Balance: ''
        },
        normalizedDate: new Date(),
        normalizedAmount: 0,
        direction: 'unknown',
        merchantName: 'DOCUMENT TEXT',
        category: 'UNCATEGORIZED',
        balance: null,
        symbol: null,
        quantity: null,
        price: null,
        pnl: null,
      });
    }

    if (rows.length === 0) {
      throw new Error('Failed to parse PDF. The file appears to be empty or unreadable.');
    }

    return { rows, headerMap, fileType: 'generic_document' };
  }

  return { rows, headerMap, fileType: 'bank_statement' };
}
