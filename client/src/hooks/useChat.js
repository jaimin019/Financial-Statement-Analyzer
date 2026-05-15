import { useState, useCallback, useRef } from 'react';
import { useSSE } from './useSSE.js';
import * as api from '../services/api.js';

let msgIdCounter = 0;
const nextId = () => `msg-${++msgIdCounter}-${Date.now()}`;

function rawToUI(m) {
  return {
    id: nextId(),
    role: m.role,
    content: m.content,
    citedRowIndexes: m.citedRows ?? [],
    sourceTransactions: [],
    isStreaming: false,
    isHistorical: true,
    timestamp: m.timestamp,
  };
}

/**
 * Manages conversation state: messages, session, streaming, history loading.
 * Token accumulation uses a 50ms flush interval to cap re-renders at ~20 Hz.
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [session, setSessionState] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [currentHistoryPage, setCurrentHistoryPage] = useState(1);
  const [citationLoadingIds, setCitationLoadingIds] = useState(new Set());

  const { sendMessage: sseSend } = useSSE();
  const tokenBufferRef = useRef('');
  const flushIntervalRef = useRef(null);
  const assistantIdRef = useRef(null);

  const setSession = useCallback((data) => {
    setSessionId(data.sessionId);
    setSessionState(data);
  }, []);

  const clearSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setSessionState(null);
    setStatusText('');
    setIsStreaming(false);
    setIsLoadingHistory(false);
    setHasMoreMessages(false);
    setCurrentHistoryPage(1);
  }, []);

  // ── 50ms token flush ──────────────────────────────────────
  const startFlushing = useCallback(() => {
    if (flushIntervalRef.current) return;
    flushIntervalRef.current = setInterval(() => {
      const buffered = tokenBufferRef.current;
      if (buffered) {
        tokenBufferRef.current = '';
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantIdRef.current) {
            return [...prev.slice(0, -1), { ...last, content: last.content + buffered }];
          }
          return prev;
        });
      }
    }, 50);
  }, []);

  const stopFlushing = useCallback(() => {
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    const remaining = tokenBufferRef.current;
    if (remaining) {
      tokenBufferRef.current = '';
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === assistantIdRef.current) {
          return [...prev.slice(0, -1), { ...last, content: last.content + remaining }];
        }
        return prev;
      });
    }
  }, []);

  // ── Load session history ──────────────────────────────────
  const loadSession = useCallback(async (sid, sessionMeta) => {
    setIsLoadingHistory(true);
    setMessages([]);
    setSessionId(sid);
    setSessionState(sessionMeta);

    try {
      const { messages: rawMessages, pagination } = await api.getSessionMessages(sid, 1, 50);
      setMessages(rawMessages.map(rawToUI));
      setHasMoreMessages(pagination.hasMore);
      setCurrentHistoryPage(1);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // ── Load earlier messages (prepend, preserve scroll) ─────
  const loadEarlierMessages = useCallback(async (containerRef) => {
    if (!hasMoreMessages || isLoadingMore || !sessionId) return;
    setIsLoadingMore(true);

    const prevScrollHeight = containerRef?.current?.scrollHeight ?? 0;
    const nextPage = currentHistoryPage + 1;

    try {
      const { messages: olderRaw, pagination } = await api.getSessionMessages(sessionId, nextPage, 50);
      const olderUI = olderRaw.map(rawToUI);
      setMessages((prev) => [...olderUI, ...prev]);
      setCurrentHistoryPage(nextPage);
      setHasMoreMessages(pagination.hasMore);

      requestAnimationFrame(() => {
        if (containerRef?.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight - prevScrollHeight;
        }
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreMessages, isLoadingMore, sessionId, currentHistoryPage]);

  // ── Citation lazy loading ─────────────────────────────────
  const setCitationLoading = useCallback((msgId, loading) => {
    setCitationLoadingIds((prev) => {
      const next = new Set(prev);
      if (loading) next.add(msgId);
      else next.delete(msgId);
      return next;
    });
  }, []);

  const updateMessage = useCallback((msgId, patch) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, ...patch } : m)
    );
  }, []);

  // ── Send message ──────────────────────────────────────────
  const sendMessage = useCallback(async (question) => {
    if (!sessionId || !question.trim()) return;

    const userId = nextId();
    const assistantId = nextId();
    assistantIdRef.current = assistantId;

    const userMsg = { id: userId, role: 'user', content: question, citedRowIndexes: [], sourceTransactions: [], isStreaming: false };
    const assistantMsg = { id: assistantId, role: 'assistant', content: '', citedRowIndexes: [], sourceTransactions: [], isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    tokenBufferRef.current = '';

    const chatHistory = messages
      .filter((m) => m.content)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    startFlushing();

    await sseSend(sessionId, question, chatHistory, {
      onStatus: (msg) => setStatusText(msg),
      onToken: (token) => { tokenBufferRef.current += token; },
      onCitations: (data) => {
        stopFlushing();
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantIdRef.current) {
            return [...prev.slice(0, -1), {
              ...last,
              citedRowIndexes: data.citedRowIndexes || [],
              sourceTransactions: data.sourceTransactions || [],
            }];
          }
          return prev;
        });
      },
      onChart: (chartData) => {
        if (!chartData) return;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantIdRef.current) {
            return [...prev.slice(0, -1), { ...last, chartData }];
          }
          return prev;
        });
      },
      onDone: () => {
        stopFlushing();
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantIdRef.current) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return prev;
        });
        setStatusText('');
        setIsStreaming(false);
      },
      onError: (msg) => {
        stopFlushing();
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantIdRef.current) {
            return [...prev.slice(0, -1), { ...last, content: `⚠️ Error: ${msg}`, isStreaming: false }];
          }
          return prev;
        });
        setStatusText('');
        setIsStreaming(false);
      },
    });
  }, [sessionId, messages, sseSend, startFlushing, stopFlushing]);

  return {
    messages, sessionId, session, statusText, isStreaming,
    isLoadingHistory, isLoadingMore, hasMoreMessages,
    citationLoadingIds,
    setSession, sendMessage, clearSession, loadSession,
    loadEarlierMessages, setCitationLoading, updateMessage,
  };
}
