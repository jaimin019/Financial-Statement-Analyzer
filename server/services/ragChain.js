import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { hybridSearch } from './hybridSearch.js';
import { rewriteQuery } from './queryRewriter.js';
import RawTransaction from '../models/RawTransaction.js';
import Session from '../models/Session.js';

// ── 1. Non-streaming LLM ────────────────────────────────────
const llm = new ChatGroq({
  model: process.env.CHAT_MODEL || 'llama-3.3-70b-versatile',
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
  streaming: false,
});

// ── 1b. Streaming LLM instance ─────────────────────────────
const llmStreaming = new ChatGroq({
  model: process.env.CHAT_MODEL || 'llama-3.3-70b-versatile',
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
  streaming: true,
});

// ── 2. System Prompt ────────────────────────────────────────
const SYSTEM_PROMPT = `You are a precise financial analyst AI assistant. Your ONLY job is to
answer questions about the user's uploaded financial data.

STRICT RULES — you must follow all of these without exception:
1. Answer ONLY from the transaction data provided in the CONTEXT section.
   Never use outside knowledge, never estimate, never guess.
2. Every specific figure, date, merchant name, or transaction you mention
   MUST be followed immediately by its row citation in this exact format:
   [Row N] for single rows, [Rows N, M, P] for multiple rows.
3. When asked to calculate totals, averages, or counts, show your working:
   list the individual cited amounts, then state the result.
4. If the retrieved context does not contain enough information to
   fully answer the question, respond with:
   "I could not find sufficient data in your uploaded statement to answer
   this completely. The available data shows: [state what you can from
   context]. For a complete answer, please ensure the relevant date range
   is included in your uploaded file."
5. NEVER invent transaction details, merchant names, or amounts.
6. Format all currency as ₹X,XX,XXX (Indian numbering system).
7. For trading log queries, always state whether P&L is realized or
   unrealized if that information is available in context.`;

// ── 2b. Investment-Specific Addendum ────────────────────────
const INVESTMENT_SYSTEM_ADDENDUM = `

ADDITIONAL INVESTMENT DATA RULES:
- For holdings data: current values are point-in-time snapshots, NOT historical.
  Always state "as of the snapshot date" when referencing holdings values.
- For P&L data: clearly distinguish between realized P&L (closed positions)
  and unrealized P&L (open positions). Always state which type you are citing.
- For trade data: when calculating average buy/sell prices, use quantity-weighted
  averages. Show the formula: total cost / total quantity.
- For mutual fund data: NAV × units = current value. SIP = Systematic Investment Plan.
  Distinguish between lumpsum and SIP transactions when the data shows it.
- When asked about portfolio allocation, express each holding as a percentage
  of the total portfolio value.
- For investment summaries: always mention total invested, current value, and
  absolute + percentage P&L.
- Use ₹ for all currency. Format large numbers in Indian notation (lakhs/crores).`;

const INVESTMENT_FILE_TYPES = new Set([
  'groww_mf', 'groww_stocks', 'groww_holdings',
  'zerodha_tradebook', 'zerodha_pnl', 'zerodha_ledger', 'zerodha_holdings',
]);

// ── 3. Prompt Template ──────────────────────────────────────
function buildPrompt(fileType) {
  const systemMsg = INVESTMENT_FILE_TYPES.has(fileType)
    ? SYSTEM_PROMPT + INVESTMENT_SYSTEM_ADDENDUM
    : SYSTEM_PROMPT;

  return ChatPromptTemplate.fromMessages([
    ['system', systemMsg],
    new MessagesPlaceholder('chat_history'),
    ['human', `CONTEXT (retrieved from your uploaded financial data):
{context}

User question: {question}`],
  ]);
}

// Keep a default prompt for backward compatibility
const prompt = buildPrompt('bank_statement');

// ── 4. Context Formatter ────────────────────────────────────
function formatContext(docs) {
  if (!docs || docs.length === 0) {
    return 'No relevant transaction data was found for this query.';
  }
  return docs
    .map((doc, idx) => `--- Source ${idx + 1} ---\n${doc.pageContent}`)
    .join('\n\n');
}

// ── 5. Citation Extractor ───────────────────────────────────
export function extractCitedRowIndexes(text) {
  const regex = /\[Rows?\s+([\d,\s]+)\]/g;
  const allIndexes = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const nums = match[1].split(',').map((s) => parseInt(s.trim(), 10));
    for (const n of nums) {
      if (!isNaN(n)) allIndexes.add(n);
    }
  }
  return [...allIndexes].sort((a, b) => a - b);
}

// ── 6. Date-range post-filter ───────────────────────────────
function filterByDateRange(docs, dateRange) {
  if (!dateRange || !dateRange.start) return docs;

  return docs.filter((doc) => {
    const meta = doc.metadata || {};
    const drEnd = meta.dateRange?.end ? new Date(meta.dateRange.end) : null;
    const drStart = meta.dateRange?.start ? new Date(meta.dateRange.start) : null;

    // Keep if chunk date range overlaps with query date range
    if (!drStart && !drEnd) return true; // no date info → keep
    const chunkEnd = drEnd ?? drStart;
    const chunkStart = drStart ?? drEnd;
    return chunkEnd >= dateRange.start && chunkStart <= dateRange.end;
  });
}

// ── 7. Main RAG Query Function ──────────────────────────────

/**
 * Executes a full RAG pipeline with hybrid search, query rewriting,
 * date-range filtering, and optional streaming.
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.question
 * @param {{ role: 'user'|'assistant', content: string }[]} [params.chatHistory]
 * @param {Function} [params.onToken] - Optional streaming callback
 * @returns {Promise<{ answer, citedRowIndexes, sourceTransactions, retrievedChunks }>}
 */
export async function runRAGQuery({ sessionId, question, chatHistory, onToken }) {
  try {
    console.time(`⏱️  RAG query: "${question.slice(0, 50)}..."`);

    // a. Fetch session metadata for query rewriter
    const sessionMeta = await Session.findOne(
      { sessionId },
      { uploadedAt: 1, fileType: 1, rowCount: 1 }
    ).lean();

    // b. Rewrite query (date resolution + merchant expansion)
    const { rewrittenQuery, detectedDateRange, wasRewritten } =
      await rewriteQuery(question, sessionMeta || {});

    if (wasRewritten && process.env.NODE_ENV === 'development') {
      console.log(`🔄 Query rewritten. Date range:`, detectedDateRange);
    }

    // c. Hybrid search using rewritten query
    let docs = await hybridSearch(sessionId, rewrittenQuery, 8);
    if (process.env.NODE_ENV === 'development') {
      console.log(`📎 Retrieved ${docs.length} chunks via hybrid search`);
    }

    // d. Post-filter by date range if detected
    if (detectedDateRange.start) {
      docs = filterByDateRange(docs, detectedDateRange);
      if (process.env.NODE_ENV === 'development') {
        console.log(`📅 After date filter: ${docs.length} chunks remain`);
      }
    }

    // e. Format context
    const formattedContext = formatContext(docs);

    // f. Convert chatHistory to LangChain messages (last 6 turns)
    const recentHistory = (chatHistory || []).slice(-6);
    const chatMessages = recentHistory.map((msg) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    // g. Format prompt (use investment-aware prompt if applicable)
    const activePrompt = buildPrompt(sessionMeta?.fileType);
    const formattedPrompt = await activePrompt.formatMessages({
      context: formattedContext,
      question, // use ORIGINAL question so user sees their own phrasing
      chat_history: chatMessages,
    });

    let answer;

    if (onToken) {
      // STREAMING MODE
      const stream = await llmStreaming.stream(formattedPrompt);
      const tokenBuffer = [];
      for await (const chunk of stream) {
        const text = chunk.content || '';
        if (text) {
          tokenBuffer.push(text);
          onToken(text);
        }
      }
      answer = tokenBuffer.join('');
    } else {
      // NON-STREAMING MODE (backward-compatible)
      const response = await llm.invoke(formattedPrompt);
      const parser = new StringOutputParser();
      answer = await parser.invoke(response);
    }

    // h. Extract citations
    const citedRowIndexes = extractCitedRowIndexes(answer);
    if (process.env.NODE_ENV === 'development') {
      console.log(`📝 Cited rows: [${citedRowIndexes.join(', ')}]`);
    }

    // i. Fetch source RawTransaction docs
    let sourceTransactions = [];
    if (citedRowIndexes.length > 0) {
      sourceTransactions = await RawTransaction.find(
        { sessionId, rowIndex: { $in: citedRowIndexes } },
        { rawData: 1, rowIndex: 1, normalizedDate: 1, normalizedAmount: 1, direction: 1, merchantName: 1, category: 1 }
      ).lean();
    }

    return {
      answer,
      citedRowIndexes,
      sourceTransactions,
      retrievedChunks: docs.map((d) => ({ text: d.pageContent })),
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Executes RAG but appends a prompt asking for a JSON CHART_DATA block
 * if the answer contains numerical data worth charting.
 */
export async function runStructuredRAGQuery({ sessionId, question, chatHistory, onToken }) {
  const chartPromptInstruction = `
Additionally, if your answer contains numerical data that could be visualized, return a JSON block at the END of your response in this exact format (after your text answer):

CHART_DATA:
{
  "type": "bar",
  "title": "Your Chart Title",
  "xAxisLabel": "X Axis Label",
  "yAxisLabel": "Y Axis Label",
  "data": [
    { "label": "Label 1", "value": 100 },
    { "label": "Label 2", "value": 200 }
  ]
}

Use type 'bar' for category comparisons and monthly data, 'line' for trends over time, 'pie' for proportional breakdown. Only include CHART_DATA if the answer genuinely has multi-data-point numerical content worth charting. If not, omit CHART_DATA entirely.
`;

  // We reuse runRAGQuery but pass the augmented question.
  // We don't want the user to see the augmented question, so we handle it inside runRAGQuery
  // wait, runRAGQuery uses `question` directly for the prompt.
  // Let's call runRAGQuery with the augmented question but we need to ensure the `question`
  // passed to `onToken` or whatever doesn't expose it. Actually `onToken` just streams the answer.
  
  const augmentedQuestion = question + '\n\n' + chartPromptInstruction;

  // We capture the raw output, we don't want to stream the CHART_DATA marker to the user.
  // Wait! If we stream, the user will see "CHART_DATA: { ... }" being typed out.
  // The prompt says "at the END of your response". We can intercept the stream, but it's complex.
  // For simplicity, we can let it stream (the user sees the JSON briefly) OR we can buffer
  // the end of the stream. A simpler approach: we don't stream if wantsChart is true,
  // OR we just hide the CHART_DATA on the frontend. The instructions say:
  // "After streaming completes, parse the chart data from the answer..."
  // This implies the JSON *is* streamed, and the frontend will either see it or we filter it.
  // Let's pass the augmented question to runRAGQuery.
  
  // Actually, let's copy the RAG logic here to have full control over the stream interception
  // so we don't stream the CHART_DATA to `onToken`.

  try {
    const sessionMeta = await Session.findOne({ sessionId }, { uploadedAt: 1, fileType: 1, rowCount: 1 }).lean();
    const { rewrittenQuery, detectedDateRange } = await rewriteQuery(question, sessionMeta || {});
    let docs = await hybridSearch(sessionId, rewrittenQuery, 8);
    if (detectedDateRange.start) docs = filterByDateRange(docs, detectedDateRange);
    
    const formattedContext = formatContext(docs);
    const recentHistory = (chatHistory || []).slice(-6).map((msg) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    const formattedPrompt = await buildPrompt(sessionMeta?.fileType).formatMessages({
      context: formattedContext,
      question: augmentedQuestion,
      chat_history: recentHistory,
    });

    let fullAnswer = '';
    
    if (onToken) {
      const stream = await llmStreaming.stream(formattedPrompt);
      let buffer = '';
      const CHART_MARKER = 'CHART_DATA:';
      let foundMarker = false;

      for await (const chunk of stream) {
        const text = chunk.content || '';
        if (text) {
          buffer += text;
          // Check if we hit the marker
          if (!foundMarker) {
            const possibleMarkerIdx = buffer.indexOf('CHART_DATA');
            if (possibleMarkerIdx !== -1) {
              // Only stream up to the marker
              const safeText = buffer.slice(0, possibleMarkerIdx);
              if (safeText.length > fullAnswer.length) {
                const newContent = safeText.slice(fullAnswer.length);
                if (newContent) {
                  onToken(newContent);
                  fullAnswer += newContent;
                }
              }
              foundMarker = true;
            } else {
              // Stream safely, keeping enough buffer to detect CHART_DATA
              const safeLen = Math.max(0, buffer.length - CHART_MARKER.length);
              if (safeLen > fullAnswer.length) {
                const newContent = buffer.slice(fullAnswer.length, safeLen);
                onToken(newContent);
                fullAnswer += newContent;
              }
            }
          }
        }
      }
      // Loop done. `buffer` holds the complete LLM output.
      fullAnswer = buffer; // for parsing later
    } else {
      const response = await llm.invoke(formattedPrompt);
      const parser = new StringOutputParser();
      fullAnswer = await parser.invoke(response);
    }

    // Now parse the chart data from the full answer
    const CHART_MARKER = 'CHART_DATA:';
    const markerIndex = fullAnswer.indexOf(CHART_MARKER);
    let chartData = null;
    let cleanAnswer = fullAnswer;

    if (markerIndex !== -1) {
      const jsonStr = fullAnswer.slice(markerIndex + CHART_MARKER.length).trim();
      try {
        chartData = JSON.parse(jsonStr);
        cleanAnswer = fullAnswer.slice(0, markerIndex).trim();
      } catch (e) {
        chartData = null; // Ignore malformed JSON
      }
    }

    const citedRowIndexes = extractCitedRowIndexes(cleanAnswer);
    let sourceTransactions = [];
    if (citedRowIndexes.length > 0) {
      sourceTransactions = await RawTransaction.find(
        { sessionId, rowIndex: { $in: citedRowIndexes } },
        { rawData: 1, rowIndex: 1, normalizedDate: 1, normalizedAmount: 1, direction: 1, merchantName: 1, category: 1 }
      ).lean();
    }

    return {
      answer: cleanAnswer,
      chartData,
      citedRowIndexes,
      sourceTransactions,
      retrievedChunks: docs.map((d) => ({ text: d.pageContent })),
    };
  } catch (err) {
    throw err;
  }
}

// ── 8. Insights Generator ────────────────────────────────────

/**
 * Generates a full InsightReport for a session using MongoDB
 * aggregation pipelines (never fetches all docs to JS).
 * Called fire-and-forget from the upload route.
 *
 * @param {string} sessionId
 * @param {{ rowCount: number, fileType: string }} sessionMeta
 * @returns {Promise<InsightReport>}
 */
export async function generateInsights(sessionId, sessionMeta) {
  // ── Run all aggregations in parallel ─────────────────────
  const [
    categoriesRaw,
    flowRaw,
    recurringRaw,
    largestRaw,
    allAmountsRaw,
    dateRangeRaw,
  ] = await Promise.all([
    // Top categories by spend
    RawTransaction.aggregate([
      { $match: { sessionId } },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$normalizedAmount' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: 1 } }, // most negative = most spent
      { $limit: 5 },
    ]),

    // Income vs expense
    RawTransaction.aggregate([
      { $match: { sessionId } },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [{ $gt: ['$normalizedAmount', 0] }, '$normalizedAmount', 0],
            },
          },
          totalExpense: {
            $sum: {
              $cond: [{ $lt: ['$normalizedAmount', 0] }, '$normalizedAmount', 0],
            },
          },
        },
      },
    ]),

    // Recurring merchants (3+ transactions)
    RawTransaction.aggregate([
      { $match: { sessionId } },
      {
        $group: {
          _id: '$merchantName',
          count: { $sum: 1 },
          totalSpent: { $sum: '$normalizedAmount' },
          avgAmount: { $avg: '$normalizedAmount' },
        },
      },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),

    // Largest single expense
    RawTransaction.aggregate([
      { $match: { sessionId, normalizedAmount: { $lt: 0 } } },
      { $sort: { normalizedAmount: 1 } },
      { $limit: 1 },
      { $project: { normalizedAmount: 1, merchantName: 1, normalizedDate: 1, rowIndex: 1 } },
    ]),

    // All amounts for anomaly detection
    RawTransaction.find({ sessionId }, { normalizedAmount: 1, merchantName: 1, normalizedDate: 1, rowIndex: 1 }).lean(),

    // Date range
    RawTransaction.aggregate([
      { $match: { sessionId, normalizedDate: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          start: { $min: '$normalizedDate' },
          end: { $max: '$normalizedDate' },
        },
      },
    ]),
  ]);

  // ── Compute total expense for percent-of-total ────────────
  const totalExpenseAbs = Math.abs(flowRaw[0]?.totalExpense ?? 0);
  const topCategories = categoriesRaw.map((c) => ({
    category: c._id || 'Uncategorized',
    totalSpent: c.totalSpent,
    transactionCount: c.transactionCount,
    percentOfTotal: totalExpenseAbs > 0
      ? Math.round((Math.abs(c.totalSpent) / totalExpenseAbs) * 100)
      : 0,
  }));

  // ── Income vs expense ─────────────────────────────────────
  const incomeVsExpense = {
    totalIncome: flowRaw[0]?.totalIncome ?? 0,
    totalExpense: flowRaw[0]?.totalExpense ?? 0,
    netFlow: (flowRaw[0]?.totalIncome ?? 0) + (flowRaw[0]?.totalExpense ?? 0),
  };

  // ── Recurring merchants ───────────────────────────────────
  const recurringMerchants = recurringRaw.map((r) => ({
    merchantName: r._id || 'Unknown',
    count: r.count,
    totalSpent: r.totalSpent,
    avgAmount: r.avgAmount,
  }));

  // ── Largest expense ───────────────────────────────────────
  const largestExpense = largestRaw[0]
    ? {
        amount: largestRaw[0].normalizedAmount,
        merchantName: largestRaw[0].merchantName,
        date: largestRaw[0].normalizedDate,
        rowIndex: largestRaw[0].rowIndex,
      }
    : null;

  // ── Anomaly detection (z-score) ───────────────────────────
  const amounts = allAmountsRaw.map((r) => r.normalizedAmount).filter((a) => a != null);
  const mean = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;
  const variance = amounts.length > 1
    ? amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length
    : 0;
  const stddev = Math.sqrt(variance);

  const unusualTransactions = stddev > 0
    ? allAmountsRaw
        .filter((r) => r.normalizedAmount != null && Math.abs(r.normalizedAmount - mean) > 2 * stddev)
        .map((r) => ({
          amount: r.normalizedAmount,
          merchantName: r.merchantName,
          date: r.normalizedDate,
          rowIndex: r.rowIndex,
          zScore: parseFloat(((r.normalizedAmount - mean) / stddev).toFixed(2)),
        }))
        .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
        .slice(0, 3)
    : [];

  // ── Date range ────────────────────────────────────────────
  const dateRange = dateRangeRaw[0]
    ? {
        start: dateRangeRaw[0].start,
        end: dateRangeRaw[0].end,
        daysSpanned: Math.round(
          (new Date(dateRangeRaw[0].end) - new Date(dateRangeRaw[0].start)) / (1000 * 60 * 60 * 24)
        ),
      }
    : null;

  // ── AI summary (max 200 tokens, non-streaming) ────────────
  const stats = {
    rowCount: sessionMeta.rowCount,
    fileType: sessionMeta.fileType,
    incomeVsExpense,
    topCategories: topCategories.slice(0, 3),
    largestExpense,
    recurringMerchants: recurringMerchants.slice(0, 3),
    unusualCount: unusualTransactions.length,
    dateRange,
  };

  let summary = '';
  try {
    const summaryLLM = new ChatGroq({
      model: process.env.CHAT_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0,
      apiKey: process.env.GROQ_API_KEY,
      maxTokens: 200,
      streaming: false,
    });
    const summaryPrompt = `Given these financial statistics: ${JSON.stringify(stats)}, write a 2-3 sentence executive summary for the user about their financial patterns. Be specific with numbers. Use ₹ for currency. Be direct and insightful, not generic.`;
    const response = await summaryLLM.invoke([{ role: 'user', content: summaryPrompt }]);
    summary = response.content || '';
  } catch (_) {
    summary = `Your statement covers ${dateRange?.daysSpanned ?? '?'} days with ${sessionMeta.rowCount} transactions totalling ₹${Math.abs(incomeVsExpense.totalExpense).toLocaleString('en-IN')} in expenses and ₹${incomeVsExpense.totalIncome.toLocaleString('en-IN')} in income.`;
  }

  return {
    summary,
    topCategories,
    largestExpense,
    recurringMerchants,
    incomeVsExpense,
    unusualTransactions,
    dateRange,
    generatedAt: new Date(),
  };
}

// ── 9. Workspace Cross-Analysis RAG ─────────────────────────

const WORKSPACE_SYSTEM_PROMPT = `You are a precise financial analyst AI assistant. Your ONLY job is to
answer questions about the user's uploaded financial data, which may come from MULTIPLE files.

STRICT RULES — you must follow all of these without exception:
1. Answer ONLY from the transaction data provided in the CONTEXT section.
   Never use outside knowledge, never estimate, never guess.
2. Every specific figure, date, merchant name, or transaction you mention
   MUST be followed immediately by its row citation in this exact format:
   [Row N, filename.csv] for single rows from a specific file.
3. When data comes from multiple files, always specify which file each
   cited row comes from using the format [Row N, filename.csv].
   Never mix data from different files without clearly attributing each piece.
4. When asked to calculate totals, averages, or counts, show your working:
   list the individual cited amounts, then state the result.
5. If the retrieved context does not contain enough information to
   fully answer the question, respond with:
   "I could not find sufficient data in your uploaded statements to answer
   this completely. The available data shows: [state what you can from
   context]. For a complete answer, please ensure the relevant date range
   is included in your uploaded files."
6. NEVER invent transaction details, merchant names, or amounts.
7. Format all currency as ₹X,XX,XXX (Indian numbering system).
8. For trading log queries, always state whether P&L is realized or
   unrealized if that information is available in context.`;

const workspacePrompt = ChatPromptTemplate.fromMessages([
  ['system', WORKSPACE_SYSTEM_PROMPT],
  new MessagesPlaceholder('chat_history'),
  ['human', `CONTEXT (retrieved from multiple uploaded financial files):
{context}

User question: {question}`],
]);

/**
 * Extracts workspace-style citations: [Row N, filename.csv]
 * Returns an array of { rowIndex, filename } objects.
 */
export function extractWorkspaceCitations(text) {
  const regex = /\[Rows?\s+([\d,\s]+),\s*([^\]]+)\]/g;
  const citations = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const nums = match[1].split(',').map(s => parseInt(s.trim(), 10));
    const filename = match[2].trim();
    for (const n of nums) {
      if (!isNaN(n)) citations.push({ rowIndex: n, filename });
    }
  }
  // Also try the single-row format without filename (fallback)
  const simpleCitations = extractCitedRowIndexes(text);
  for (const idx of simpleCitations) {
    if (!citations.some(c => c.rowIndex === idx)) {
      citations.push({ rowIndex: idx, filename: '' });
    }
  }
  return citations;
}

/**
 * Executes a cross-analysis RAG query across all sessions in a workspace.
 *
 * @param {Object} params
 * @param {string} params.workspaceId - Workspace _id
 * @param {string} params.question
 * @param {{ role: 'user'|'assistant', content: string }[]} [params.chatHistory]
 * @param {Function} [params.onToken] - Optional streaming callback
 * @param {Object} params.workspace - Pre-fetched and populated workspace document
 * @returns {Promise<{ answer, citedRowIndexes, sourceTransactions, sourceFiles }>}
 */
export async function runWorkspaceRAGQuery({ workspaceId, question, chatHistory, onToken, workspace }) {
  try {
    // a. Build sessionId list and sessionId-to-filename map
    const sessionIdMap = {};
    const sessionStringIds = [];
    for (const s of workspace.sessionIds) {
      const sid = s.sessionId;
      sessionIdMap[sid] = s.filename;
      sessionStringIds.push(sid);
    }

    if (sessionStringIds.length === 0) {
      throw new Error('Workspace has no sessions to analyze.');
    }

    // b. Multi-session hybrid search
    const { similaritySearch } = await import('./vectorStore.js');
    let docs = await similaritySearch(sessionStringIds, question, 12);

    // c. Annotate each chunk with its source filename
    const annotatedDocs = docs.map((doc) => {
      const chunkSessionId = doc.metadata?.sessionId;
      const filename = sessionIdMap[chunkSessionId] || 'Unknown file';
      const rowIndex = doc.metadata?.rowIndex ?? '';
      const prefix = rowIndex !== '' ? `[Source: ${filename}, Row ${rowIndex}]` : `[Source: ${filename}]`;
      return {
        ...doc,
        pageContent: `${prefix}\n${doc.pageContent}`,
      };
    });

    // d. Format context
    const formattedContext = annotatedDocs.length > 0
      ? annotatedDocs.map((doc, idx) => `--- Source ${idx + 1} ---\n${doc.pageContent}`).join('\n\n')
      : 'No relevant transaction data was found across the workspace files for this query.';

    // e. Chat history
    const recentHistory = (chatHistory || []).slice(-6);
    const chatMessages = recentHistory.map((msg) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    // f. Format prompt
    const formattedPromptMessages = await workspacePrompt.formatMessages({
      context: formattedContext,
      question,
      chat_history: chatMessages,
    });

    // g. Stream or invoke
    let answer;
    if (onToken) {
      const stream = await llmStreaming.stream(formattedPromptMessages);
      const tokenBuffer = [];
      for await (const chunk of stream) {
        const text = chunk.content || '';
        if (text) {
          tokenBuffer.push(text);
          onToken(text);
        }
      }
      answer = tokenBuffer.join('');
    } else {
      const response = await llm.invoke(formattedPromptMessages);
      const parser = new StringOutputParser();
      answer = await parser.invoke(response);
    }

    // h. Extract workspace citations
    const workspaceCitations = extractWorkspaceCitations(answer);
    const citedRowIndexes = workspaceCitations.map(c => ({
      sessionId: Object.entries(sessionIdMap).find(([, fn]) => fn === c.filename)?.[0] || '',
      rowIndex: c.rowIndex,
    })).filter(c => c.sessionId);

    // Also extract simple row indexes for backward compat
    const simpleRowIndexes = extractCitedRowIndexes(answer);

    // i. Fetch source transactions from all relevant sessions
    let sourceTransactions = [];
    if (citedRowIndexes.length > 0) {
      const bySession = {};
      for (const c of citedRowIndexes) {
        if (!bySession[c.sessionId]) bySession[c.sessionId] = [];
        bySession[c.sessionId].push(c.rowIndex);
      }
      const queries = Object.entries(bySession).map(([sid, rows]) =>
        RawTransaction.find(
          { sessionId: sid, rowIndex: { $in: rows } },
          { rawData: 1, rowIndex: 1, sessionId: 1, normalizedDate: 1, normalizedAmount: 1, direction: 1, merchantName: 1, category: 1 }
        ).lean()
      );
      const results = await Promise.all(queries);
      sourceTransactions = results.flat();
    }

    // j. Build sourceFiles list for the frontend
    const sourceFiles = sessionStringIds.map(sid => ({
      sessionId: sid,
      filename: sessionIdMap[sid],
    }));

    return {
      answer,
      citedRowIndexes,
      sourceTransactions,
      sourceFiles,
    };
  } catch (err) {
    throw err;
  }
}
