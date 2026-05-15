import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { useChat } from '../hooks/useChat.js';
import SessionList from '../components/SessionList.jsx';
import WorkspaceList from '../components/WorkspaceList.jsx';
import AnalyticsTab from '../components/AnalyticsTab.jsx';
import FileUploader from '../components/FileUploader.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import BrandLockup from '../components/BrandLockup.jsx';
import Integrations from './Integrations.jsx';

const viewVariants = {
  dashboard: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -8 },
  },
  chat: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: 8 },
  },
};

const TABS = [
  { key: 'statements', label: 'Statements' },
  { key: 'workspaces', label: 'Workspaces' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'integrations', label: 'Integrations' },
];

/**
 * AppShell — main authenticated view at /app.
 *
 * Chat is a VIEW STATE inside /app, not a separate URL.
 * View state is stored in location.state (history-integrated)
 * so that browser back/forward and mobile swipe-back work correctly:
 *   - Opening chat pushes a history entry
 *   - Back button / swipe back pops it → returns to dashboard
 *   - Refresh on chat → defaults to dashboard (state lost, correct behavior)
 */
export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    messages, sessionId, session, statusText, isStreaming,
    isLoadingHistory, isLoadingMore, hasMoreMessages, citationLoadingIds,
    setSession, sendMessage, clearSession, loadSession,
    loadEarlierMessages, setCitationLoading, updateMessage,
  } = useChat();

  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [newSessionId, setNewSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState('statements');
  const [workspaceChatTarget, setWorkspaceChatTarget] = useState(null);
  const prefersReduced = useReducedMotion();
  const transition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.4, 0, 0.2, 1] };

  // Read view from location.state (history-integrated).
  // Default to 'dashboard' if no state (e.g. on refresh).
  const isWorkspaceChat = location.state?.view === 'workspace-chat' && workspaceChatTarget;
  const currentView = isWorkspaceChat
    ? 'chat'
    : location.state?.view === 'chat' && sessionId
      ? 'chat'
      : sessionId ? 'chat' : 'dashboard';

  const handleUploadSuccess = (data) => {
    setIsUploaderOpen(false);
    setNewSessionId(data.sessionId);
    setSession(data);
    // Push a chat history entry so back button returns to dashboard
    navigate('/app', { state: { view: 'chat' } });
  };

  const handleLoadSession = async (s) => {
    await loadSession(s.sessionId, s);
    // Push a chat history entry — swipe back pops this → dashboard
    navigate('/app', { state: { view: 'chat' } });
  };

  const handleWorkspaceAnalyze = (ws) => {
    setWorkspaceChatTarget(ws);
    clearSession();
    navigate('/app', { state: { view: 'workspace-chat' } });
  };

  // Navigate back to dashboard — pops the chat history entry
  const handleBackToDashboard = () => {
    clearSession();
    setWorkspaceChatTarget(null);
    // Use navigate(-1) if we pushed a chat entry, else navigate to /app
    if (location.state?.view === 'chat' || location.state?.view === 'workspace-chat') {
      navigate(-1);
    } else {
      navigate('/app', { replace: true });
    }
  };

  // Sign out — clear auth, replace history with landing page
  const handleSignOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const renderCurrentView = () => {
    // Workspace chat view
    if (currentView === 'chat' && isWorkspaceChat) {
      return (
        <ErrorBoundary>
          <WorkspaceChatView
            workspace={workspaceChatTarget}
            onBack={handleBackToDashboard}
            transition={transition}
          />
        </ErrorBoundary>
      );
    }

    if (currentView === 'chat') {
      return (
        <ErrorBoundary>
          <ChatWindow
            messages={messages}
            session={session}
            statusText={statusText}
            isStreaming={isStreaming}
            isLoadingHistory={isLoadingHistory}
            isLoadingMore={isLoadingMore}
            hasMoreMessages={hasMoreMessages}
            citationLoadingIds={citationLoadingIds}
            onSendMessage={sendMessage}
            onLoadEarlierMessages={loadEarlierMessages}
            onSetCitationLoading={setCitationLoading}
            onUpdateMessage={updateMessage}
            onNewSession={handleBackToDashboard}
            transition={transition}
          />
        </ErrorBoundary>
      );
    }

    // dashboard view
    return (
      <div className="app-container">
        <div className="app-topbar">
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <BrandLockup />
          </div>
          <div className="user-menu">
            <span className="user-email">{user?.email || 'User'}</span>
            {user?.isAdmin && (
              <button className="ghost-btn" style={{ color: 'var(--primary)' }} onClick={() => navigate('/app/admin')}>
                Admin Dashboard
              </button>
            )}
            <button className="ghost-btn" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex', gap: '0.25rem', padding: '0 1.5rem',
          borderBottom: '1px solid var(--border)', marginBottom: '0.5rem',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.75rem 1.25rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ErrorBoundary>
          {activeTab === 'statements' && (
            <SessionList
              onLoadSession={handleLoadSession}
              onNewUpload={() => setIsUploaderOpen(true)}
              newSessionId={newSessionId}
              transition={transition}
            />
          )}
          {activeTab === 'workspaces' && (
            <WorkspaceList
              onAnalyze={handleWorkspaceAnalyze}
              transition={transition}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab />
          )}
          {activeTab === 'integrations' && (
            <Integrations />
          )}
        </ErrorBoundary>

        <AnimatePresence>
          {isUploaderOpen && (
            <motion.div
              className="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploaderOpen(false)}
            >
              <motion.div
                className="modal-card"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <FileUploader onSessionReady={handleUploadSuccess} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView + (isWorkspaceChat ? '-ws' : '')}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={viewVariants[currentView]}
        transition={transition}
        style={{ width: '100%', height: '100%' }}
      >
        {renderCurrentView()}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Workspace Chat View ─────────────────────────────────────

function WorkspaceChatView({ workspace, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('');

  const sessions = workspace.sessionIds || [];
  const totalRows = sessions.reduce((s, sess) => s + (sess.rowCount || 0), 0);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const question = input.trim();
    setInput('');

    const userMsg = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setStatusText('');

    const chatHistory = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const token = localStorage.getItem('fsa_token');
      const response = await fetch('/api/chat/workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ workspaceId: workspace._id, question, chatHistory }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token !== undefined) {
                assistantContent += data.token;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                });
              }
              if (data.message) {
                setStatusText(data.message);
              }
            } catch { /* skip invalid JSON */ }
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
      setStatusText('');
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div className="app-topbar" style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="ghost-btn" onClick={onBack} style={{ fontSize: '1.1rem' }}>←</button>
          <div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              {workspace.name}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              {sessions.slice(0, 4).map(s => (
                <span key={s._id} style={{
                  padding: '0.125rem 0.4rem', borderRadius: 4, background: 'var(--surface-hover)',
                  fontSize: '0.65rem', color: 'var(--text-secondary)', border: '1px solid var(--border)',
                }}>
                  {s.filename}
                </span>
              ))}
            </div>
          </div>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {sessions.length} statements · {totalRows.toLocaleString()} transactions
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '3rem' }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Cross-Analysis Ready</p>
            <p style={{ fontSize: '0.85rem' }}>Ask questions across {sessions.length} statements</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '0.75rem 1rem',
              borderRadius: 12,
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--surface)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
          </div>
        ))}
        {statusText && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            {statusText}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '0.75rem', background: 'var(--surface)',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask across all statements..."
          disabled={isStreaming}
          style={{
            flex: 1, padding: '0.7rem 1rem', background: 'var(--surface-hover)', border: '1px solid var(--border)',
            borderRadius: 10, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <button
          className="primary-btn"
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          style={{ padding: '0.7rem 1.5rem' }}
        >
          {isStreaming ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
