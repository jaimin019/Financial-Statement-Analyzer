export const FILE_TYPE_LABELS: Record<string, string> = {
  bank_statement: "Bank Statement",
  bank_statement_pdf: "Bank Statement (PDF)",
  trading_log: "Trading Log",
  groww_mf: "Groww Mutual Funds",
  groww_stocks: "Groww Stocks",
  groww_holdings: "Groww Holdings",
  zerodha_tradebook: "Zerodha Tradebook",
  zerodha_pnl: "Zerodha P&L",
  zerodha_ledger: "Zerodha Ledger",
  zerodha_holdings: "Zerodha Holdings",
};

export const INVESTMENT_TYPES = new Set([
  "groww_mf", "groww_stocks", "groww_holdings",
  "zerodha_tradebook", "zerodha_pnl", "zerodha_holdings",
]);

export const BANK_TYPES = new Set(["bank_statement", "bank_statement_pdf"]);

export const isInvestmentType = (t: string) => INVESTMENT_TYPES.has(t);
export const isBankType = (t: string) => BANK_TYPES.has(t);

export const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  bank_statement: [
    "How much did I spend on food delivery?",
    "What were my top 5 expenses last month?",
    "Show me all Swiggy transactions",
    "What is my total income vs expense?",
  ],
  bank_statement_pdf: [
    "How much did I spend on food delivery?",
    "What were my top 5 expenses last month?",
    "Show me all Swiggy transactions",
  ],
  groww_holdings: [
    "Which stocks are in profit?",
    "What is my biggest losing position?",
    "Show my portfolio allocation",
  ],
  groww_stocks: [
    "What is my total realized P&L?",
    "Which stocks did I trade most?",
  ],
  groww_mf: [
    "Which funds did I invest most in?",
    "Show me my SIP transactions",
  ],
  zerodha_holdings: [
    "Which stocks are in profit?",
    "What is my portfolio allocation?",
  ],
  zerodha_pnl: [
    "What is my total realized P&L?",
    "Which symbol made me the most money?",
  ],
  zerodha_tradebook: [
    "How many trades did I make?",
    "What was my biggest single trade?",
  ],
  zerodha_ledger: [
    "What were my charges and brokerage?",
    "Show me all fund withdrawals",
  ],
  trading_log: [
    "What is my total P&L?",
    "Which trades were most profitable?",
  ],
};

export const getSuggestedQuestions = (fileType: string): string[] =>
  SUGGESTED_QUESTIONS[fileType] || SUGGESTED_QUESTIONS.bank_statement;
