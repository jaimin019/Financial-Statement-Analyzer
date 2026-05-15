import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listSessions, deleteSession } from '../services/api.js';
import Toast, { useToast } from './Toast.jsx';

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (diff < 60000) return 'just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

const containerVariants = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

// Trash icon SVG
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function SessionList({ onLoadSession, onNewUpload, newSessionId, transition, activeSessionId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [cardError, setCardError] = useState(null); // { sessionId, message }
  const [toastProps, showToast] = useToast();

  useEffect(() => {
    listSessions()
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setError('Could not load sessions.'))
      .finally(() => setLoading(false));
  }, []);

  // Auto-poll sessions that are still 'processing' so the UI
  // recovers after a page refresh during an active upload job.
  useEffect(() => {
    const processingSessions = sessions.filter((s) => s.status === 'processing');
    if (processingSessions.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const data = await listSessions();
        const updated = data.sessions || [];
        setSessions(updated);
        // Stop polling once no sessions are processing
        if (!updated.some((s) => s.status === 'processing')) {
          clearInterval(interval);
        }
      } catch {
        // Ignore poll errors — will retry next interval
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [sessions.filter((s) => s.status === 'processing').length]);

  const handleTrashClick = (e, sessionId) => {
    e.stopPropagation();
    setConfirmingId(sessionId);
    setCardError(null);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmingId(null);
  };

  const handleConfirmDelete = async (e, sessionId) => {
    e.stopPropagation();
    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId);
      // Animate out then remove from state
      // The AnimatePresence exit handles the animation
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setConfirmingId(null);
      showToast('Session deleted successfully', 'success');
    } catch (err) {
      setDeletingId(null);
      setCardError({ sessionId, message: 'Failed to delete. Try again.' });
      // Restore card after 3 seconds
      setTimeout(() => {
        setCardError(null);
        setConfirmingId(null);
      }, 3000);
    }
  };

  if (loading) {
    return <div className="session-list-loading">Loading sessions…</div>;
  }

  return (
    <div className="session-list-page">
      <Toast {...toastProps} />
      <div className="session-list-header">
        <h2>Your Statements</h2>
        <button className="upload-btn" onClick={onNewUpload}>+ Upload New</button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {sessions.length === 0 ? (
        <div className="session-empty">
          <div className="empty-icon">📄</div>
          <p className="empty-title">No statements yet</p>
          <p className="empty-subtitle">Upload your first CSV to get started</p>
          <button className="upload-btn" onClick={onNewUpload}>+ Upload New</button>
        </div>
      ) : (
        <motion.div
          className="session-cards"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          <AnimatePresence>
            {sessions.map((s) => {
              const isNew = s.sessionId === newSessionId;
              const isConfirming = confirmingId === s.sessionId;
              const isDeleting = deletingId === s.sessionId;
              const hasError = cardError?.sessionId === s.sessionId;
              const lastPreview = s.lastMessage?.content
                ? truncate(s.lastMessage.content, 80)
                : null;
              const timeLabel = relativeTime(s.lastActiveAt || s.uploadedAt);

              return (
                <motion.div
                  key={s.sessionId}
                  layout
                  variants={isNew ? undefined : itemVariants}
                  initial={isNew ? { opacity: 0, y: -16, height: 0 } : 'initial'}
                  animate={isNew ? { opacity: 1, y: 0, height: 'auto' } : 'animate'}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                  transition={isNew ? { duration: 0.28, ease: 'easeOut' } : { duration: 0.25, ease: 'easeOut' }}
                  className="session-card"
                  onClick={() => {
                    if (s.status !== 'processing' && !isConfirming) onLoadSession(s);
                  }}
                >
                  {isConfirming ? (
                    /* Inline confirmation replaces card content */
                    <div className="card-confirm">
                      {isDeleting ? (
                        <span className="btn-spinner" />
                      ) : hasError ? (
                        <p className="card-error-msg">{cardError.message}</p>
                      ) : (
                        <>
                          <p>Permanently delete <strong>{s.filename}</strong> and all its data?</p>
                          <div className="card-confirm-actions">
                            <button className="cancel-btn" onClick={handleCancelDelete}>Cancel</button>
                            <button
                              className="delete-btn-sm"
                              onClick={(e) => handleConfirmDelete(e, s.sessionId)}
                              disabled={isDeleting}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Normal card content */
                    <>
                      {/* Trash icon — visible on hover */}
                      <button
                        className="trash-btn"
                        onClick={(e) => handleTrashClick(e, s.sessionId)}
                        aria-label="Delete session"
                      >
                        <TrashIcon />
                      </button>

                      <div className="card-row-1">
                        <div className="card-filename">{s.filename}</div>
                        <button
                          className="card-load-btn"
                          disabled={s.status === 'processing'}
                        >
                          {s.status === 'processing' ? 'Wait' : 'Load →'}
                        </button>
                      </div>
                      <div className="card-row-2">
                        <span className="pill-accent">
                          {s.fileType === 'trading_log' ? 'Trading Log' : 'Bank Statement'}
                        </span>
                        {s.sourceFormat === 'pdf' && (
                          <span className="pill-accent" style={{ background: 'var(--accent-red, #ef4444)', color: 'white' }}>PDF</span>
                        )}
                        <span className="pill-neutral">{s.rowCount} rows</span>
                        {s.messageCount > 0 && (
                          <span className="pill-neutral">{s.messageCount} msg{s.messageCount > 1 ? 's' : ''}</span>
                        )}
                        <span className="pill-neutral">{timeLabel}</span>
                      </div>
                      {lastPreview && (
                        <div className="card-row-3">
                          {lastPreview}
                        </div>
                      )}
                      {(!s.messageCount || s.messageCount === 0) && (
                        <div className="new-indicator">
                          <div className="new-indicator-dot"></div>
                          New
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
