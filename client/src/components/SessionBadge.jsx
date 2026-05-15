export default function SessionBadge({ session }) {
  if (!session) return null;

  const typeLabel = session.fileType === 'trading_log' ? 'Trading Log' : 'Bank Statement';
  const filename = session.filename || '';

  return (
    <div className="chat-session-badge">
      <div className="chat-session-status-dot" />
      <div className="chat-session-filename">{filename}</div>
      <div className="chat-session-meta">
        {session.rowCount} rows · {typeLabel}
      </div>
    </div>
  );
}
