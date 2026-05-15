import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import MessageBubble from './MessageBubble.jsx';
import SourceDrawer from './SourceDrawer.jsx';
import SessionBadge from './SessionBadge.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import InsightPanel from './InsightPanel.jsx';
import BackButton from './BackButton.jsx';
import Toast, { useToast } from './Toast.jsx';
import { deleteSession } from '../services/api.js';
import * as api from '../services/api.js';

// Simple debounce utility (no library)
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const scrollPositions = {}; // { [sessionId]: scrollTop } — module-level for persistence across renders

export default function ChatWindow({
  messages, session, statusText, isStreaming,
  isLoadingHistory, isLoadingMore, hasMoreMessages, citationLoadingIds,
  onSendMessage, onLoadEarlierMessages, onSetCitationLoading, onUpdateMessage,
  onNewSession, transition,
}) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [drawerTxns, setDrawerTxns] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastProps, showToast] = useToast();
  const messagesContainerRef = useRef(null);
  const sessionId = session?.sessionId;

  // ── Scroll: save position ─────────────────────────────────
  const handleScroll = useCallback(
    debounce(() => {
      if (messagesContainerRef.current && sessionId) {
        scrollPositions[sessionId] = messagesContainerRef.current.scrollTop;
      }
    }, 150),
    [sessionId]
  );

  // ── Scroll: restore or go to bottom on session change ────
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const saved = scrollPositions[sessionId];
    if (saved !== undefined) {
      messagesContainerRef.current.scrollTop = saved;
    } else {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [sessionId]);

  // ── Scroll: auto-scroll to bottom for new streaming messages
  useEffect(() => {
    if (!isLoadingHistory && !isLoadingMore && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.isStreaming || !lastMsg.isHistorical) {
        messagesContainerRef.current?.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages.length, isLoadingHistory, isLoadingMore]);

  const handleSend = () => {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput('');
    onSendMessage(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Lazy citation fetch ───────────────────────────────────
  const handleCitationClick = async (rowIndexes, messageId) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    if (msg.sourceTransactions && msg.sourceTransactions.length > 0) {
      const matching = msg.sourceTransactions.filter((t) => rowIndexes.includes(t.rowIndex));
      setDrawerTxns(matching.length > 0 ? matching : msg.sourceTransactions);
      setDrawerOpen(true);
      return;
    }

    if (msg.citedRowIndexes && msg.citedRowIndexes.length > 0) {
      onSetCitationLoading(messageId, true);
      try {
        const { rows } = await api.fetchRows(sessionId, rowIndexes);
        onSetCitationLoading(messageId, false);
        onUpdateMessage(messageId, { sourceTransactions: rows });
        setDrawerTxns(rows);
        setDrawerOpen(true);
      } catch {
        onSetCitationLoading(messageId, false);
      }
    }
  };

  const handleSourceClick = (transactions) => {
    setDrawerTxns(transactions);
    setDrawerOpen(true);
  };

  const hasMessages = messages.length > 0;

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!sessionId) return;
    setIsExporting(true);
    try {
      const token = localStorage.getItem('fsa_token');
      const response = await fetch(`/api/reports/${sessionId}/generate`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      
      if (!response.ok) throw new Error('Failed to generate report');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${sessionId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not generate PDF report. Make sure insights are ready.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteSession = async () => {
    setIsDeleting(true);
    try {
      await deleteSession(sessionId);
      setShowDeleteModal(false);
      navigate('/app', { replace: true });
    } catch {
      setShowDeleteModal(false);
      setIsDeleting(false);
      showToast('Failed to delete session. Try again.', 'error');
    }
  };

  return (
    <div className="chat-container">
      <Toast {...toastProps} />

      {/* Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <BackButton label="Dashboard" />
          <SessionBadge session={session} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="ghost-btn-danger" onClick={() => setShowDeleteModal(true)}>Delete</button>
          <button className="ghost-btn" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? <TypingIndicator /> : 'Export PDF'}
          </button>
          <button className="ghost-btn" onClick={onNewSession}>Dashboard</button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            className="delete-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!isDeleting) setShowDeleteModal(false); }}
          >
            <motion.div
              className="delete-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Delete Session</h3>
              <div className="modal-filename">{session?.filename}</div>
              <p className="modal-warning">
                This will permanently delete this session and all its data including
                chat history, transactions, and generated insights. This action cannot be undone.
              </p>
              <div className="delete-modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="delete-btn-lg"
                  onClick={handleDeleteSession}
                  disabled={isDeleting}
                >
                  {isDeleting ? <span className="btn-spinner" /> : 'Delete Session'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div
        className="messages-list"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Load earlier messages button */}
        {hasMoreMessages && (
          <motion.div
            className="load-more-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              className="load-more-btn"
              disabled={isLoadingMore}
              onClick={() => onLoadEarlierMessages(messagesContainerRef)}
            >
              {isLoadingMore ? <TypingIndicator /> : 'Load earlier messages'}
            </button>
          </motion.div>
        )}

        {isLoadingHistory ? (
          <div className="history-loading">
            <TypingIndicator />
            <span>Loading history…</span>
          </div>
        ) : !hasMessages ? (
          <div className="empty-state">
            {sessionId && (
              <InsightPanel
                sessionId={sessionId}
                fileType={session?.fileType}
                onSendMessage={(q) => { onSendMessage(q); }}
              />
            )}
            {!sessionId && <h2>Ask anything about your transactions</h2>}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isCitationLoading={citationLoadingIds?.has(msg.id)}
              onCitationClick={(rows) => handleCitationClick(rows, msg.id)}
              onSourceClick={handleSourceClick}
            />
          ))
        )}
      </div>

      {/* Input area */}
      <div className="input-area">
        <div className="input-row">
          <AnimatePresence mode="wait">
            {statusText && (
              <motion.div
                key={statusText}
                className="chat-status-indicator"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <div className="chat-status-indicator-dot" />
                {statusText}
              </motion.div>
            )}
          </AnimatePresence>
          <textarea
            className="chat-input"
            placeholder="Ask about your transactions..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || isLoadingHistory}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={isStreaming || !input.trim() || isLoadingHistory}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      </div>

      {/* Source Drawer */}
      <SourceDrawer
        transactions={drawerTxns}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
