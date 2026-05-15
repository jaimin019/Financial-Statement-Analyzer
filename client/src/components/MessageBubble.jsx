import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import TypingIndicator from './TypingIndicator.jsx';
import InlineChart from './InlineChart.jsx';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Renders a single chat message bubble.
 * Framer Motion entrance animation fires only on MOUNT (layout=false prevents
 * re-animation on each token append during streaming).
 */
export default function MessageBubble({ message, onCitationClick, onSourceClick, isCitationLoading }) {
  const { role, content, isStreaming, citedRowIndexes, sourceTransactions, chartData } = message;
  const { user } = useAuth();

  const userInitials = (user?.email || 'U').charAt(0).toUpperCase();

  if (role === 'user') {
    return (
      <motion.div
        className="message user"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        layout={false}
      >
        <div className="bubble-wrapper">
          <div className="bubble">{content}</div>
          <div className="user-avatar">{userInitials}</div>
        </div>
      </motion.div>
    );
  }

  const showTyping = isStreaming && !content;
  const hasSources = sourceTransactions && sourceTransactions.length > 0;

  return (
    <motion.div
      className="message assistant"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      layout={false}
    >
      <div className="ai-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div className="bubble-content">
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p>{processCitations(children, onCitationClick, isCitationLoading)}</p>,
                li: ({ children }) => <li>{processCitations(children, onCitationClick, isCitationLoading)}</li>,
              }}
            >
              {content}
            </ReactMarkdown>
            {chartData && <InlineChart chartSpec={chartData} />}
            {isStreaming && <span className="blinking-cursor" />}
          </>
        )}
        {!isStreaming && hasSources && (
          <div className="source-link" onClick={() => onSourceClick?.(sourceTransactions)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            {sourceTransactions.length} source row{sourceTransactions.length > 1 ? 's' : ''} cited
          </div>
        )}
      </div>
    </motion.div>
  );
}

function processCitations(children, onCitationClick, isCitationLoading) {
  if (!children) return children;
  return Array.isArray(children)
    ? children.map((child, i) => processNode(child, i, onCitationClick, isCitationLoading))
    : processNode(children, 0, onCitationClick, isCitationLoading);
}

function processNode(node, key, onCitationClick, isCitationLoading) {
  if (typeof node !== 'string') return node;
  const regex = /(\[Rows?\s+[\d,\s]+\])/g;
  const parts = node.split(regex);
  if (parts.length === 1) return node;

  return parts.map((part, i) => {
    const match = part.match(/^\[Rows?\s+([\d,\s]+)\]$/);
    if (match) {
      const rows = match[1].split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      return (
        <span
          key={`${key}-${i}`}
          className={`citation-tag ${isCitationLoading ? 'loading' : ''}`}
          onClick={() => onCitationClick?.(rows)}
        >
          {isCitationLoading ? '⏳' : part}
        </span>
      );
    }
    return part;
  });
}
