import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listWorkspaces, deleteWorkspace } from '../services/api.js';
import WorkspaceModal from './WorkspaceModal.jsx';

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function WorkspaceList({ onAnalyze, transition }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editWorkspace, setEditWorkspace] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const fetchWorkspaces = async () => {
    try {
      const data = await listWorkspaces();
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkspaces(); }, []);

  const handleDelete = async (id) => {
    try {
      await deleteWorkspace(id);
      setWorkspaces(prev => prev.filter(w => w._id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  const handleCreated = (newWorkspace) => {
    setWorkspaces(prev => [newWorkspace, ...prev]);
    setShowModal(false);
    setEditWorkspace(null);
  };

  const handleUpdated = (updated) => {
    setWorkspaces(prev => prev.map(w => w._id === updated._id ? updated : w));
    setShowModal(false);
    setEditWorkspace(null);
  };

  if (loading) {
    return (
      <div className="session-list-container">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-card" style={{ height: 120, borderRadius: 12, marginBottom: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="session-list-container">
      <div className="session-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
            Workspaces
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Group statements for cross-analysis
          </p>
        </div>
        <button className="primary-btn" onClick={() => { setEditWorkspace(null); setShowModal(true); }}>
          + Create Workspace
        </button>
      </div>

      {workspaces.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No workspaces yet</p>
          <p style={{ fontSize: '0.875rem' }}>Create a workspace to analyze multiple statements together.</p>
        </div>
      )}

      <AnimatePresence>
        {workspaces.map((ws) => {
          const sessions = ws.sessionIds || [];
          const shown = sessions.slice(0, 3);
          const extra = sessions.length - 3;
          const totalRows = sessions.reduce((s, sess) => s + (sess.rowCount || 0), 0);

          return (
            <motion.div
              key={ws._id}
              className="session-card"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={transition}
              style={{ position: 'relative' }}
            >
              {deleteConfirmId === ws._id ? (
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: 0 }}>
                    Delete workspace <strong>{ws.name}</strong>?
                    <br />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      This will NOT delete the underlying statements.
                    </span>
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="primary-btn" style={{ background: 'var(--danger)', flex: 1 }} onClick={() => handleDelete(ws._id)}>
                      Delete
                    </button>
                    <button className="ghost-btn" style={{ flex: 1 }} onClick={() => setDeleteConfirmId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ color: 'var(--text-primary)', fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
                        {ws.name}
                      </h3>
                      {ws.description && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.25rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                          {ws.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button className="primary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }} onClick={() => onAnalyze(ws)}>
                        Analyze
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button className="ghost-btn" style={{ padding: '0.25rem 0.5rem', fontSize: '1.1rem' }} onClick={() => setMenuOpenId(menuOpenId === ws._id ? null : ws._id)}>
                          ⋮
                        </button>
                        {menuOpenId === ws._id && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 10, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                          }}>
                            <button style={{ width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                              onClick={() => { setEditWorkspace(ws); setShowModal(true); setMenuOpenId(null); }}>
                              Edit
                            </button>
                            <button style={{ width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                              onClick={() => { setDeleteConfirmId(ws._id); setMenuOpenId(null); }}>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
                    {shown.map(s => (
                      <span key={s._id} style={{
                        padding: '0.2rem 0.5rem', borderRadius: 6, background: 'var(--surface-hover)', fontSize: '0.7rem', color: 'var(--text-secondary)', border: '1px solid var(--border)',
                      }}>
                        {s.filename}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.7rem', color: 'var(--primary)' }}>
                        +{extra} more
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{sessions.length} statement{sessions.length !== 1 ? 's' : ''}</span>
                    <span>{totalRows.toLocaleString()} rows</span>
                    <span>{timeAgo(ws.createdAt)}</span>
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowModal(false); setEditWorkspace(null); }}
          >
            <motion.div
              className="modal-card"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 520, width: '90vw' }}
            >
              <WorkspaceModal
                workspace={editWorkspace}
                onCreated={handleCreated}
                onUpdated={handleUpdated}
                onCancel={() => { setShowModal(false); setEditWorkspace(null); }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
