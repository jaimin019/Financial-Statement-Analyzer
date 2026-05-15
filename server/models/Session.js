import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const { ObjectId } = mongoose.Schema.Types;

const sessionSchema = new mongoose.Schema({
  userId: {
    type: ObjectId,
    ref: 'User',
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuid(),
  },
  workspaceIds: [{
    type: ObjectId,
    ref: 'Workspace',
  }],
  filename: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    enum: ['bank_statement', 'trading_log', 'generic_document', 'groww_mf', 'groww_stocks', 'groww_holdings', 'zerodha_tradebook', 'zerodha_pnl', 'zerodha_ledger', 'zerodha_holdings'],
    required: true,
  },
  sourceFormat: {
    type: String,
    enum: ['csv', 'pdf'],
    default: 'csv',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  rowCount: {
    type: Number,
    default: 0,
  },
  columnHeaders: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ['processing', 'ready', 'error'],
    default: 'processing',
  },
  errorMessage: {
    type: String,
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    citedRows: {
      type: [Number],
      default: [],
    },
  }],

  // ── Week 5: Auto-generated insights ─────────────────────────
  insights: {
    summary: String,
    topCategories: [{
      category: String,
      totalSpent: Number,
      transactionCount: Number,
      percentOfTotal: Number,
    }],
    largestExpense: {
      amount: Number,
      merchantName: String,
      date: Date,
      rowIndex: Number,
    },
    recurringMerchants: [{
      merchantName: String,
      count: Number,
      totalSpent: Number,
      avgAmount: Number,
    }],
    incomeVsExpense: {
      totalIncome: Number,
      totalExpense: Number,
      netFlow: Number,
    },
    unusualTransactions: [{
      amount: Number,
      merchantName: String,
      date: Date,
      rowIndex: Number,
      zScore: Number,
    }],
    dateRange: {
      start: Date,
      end: Date,
      daysSpanned: Number,
    },
    generatedAt: Date,
  },
});

export default mongoose.model('Session', sessionSchema);
