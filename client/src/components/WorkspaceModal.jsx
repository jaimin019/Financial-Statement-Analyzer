import { useState, useEffect } from 'react';
import { listSessions, createWorkspace, updateWorkspace } from '../services/api.js';

export default function WorkspaceModal({ workspace, onCreated, onUpdated, onCancel }) {
  const [name, setName] = useState(workspace?.name || '');
  const [description, setDescription] = useState(workspace?.description || '');
  const [sessions, setSessions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(
    workspace?.sessionIds?.map(s => s._id) || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await listSessions();
        // API returns { sessions: [...] } or a bare array
        const list = Array.isArray(data) ? data : (data?.sessions || data || []);
        setSessions(list);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    }
    load();
  }, []);

  const toggleSession = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (workspace) {
        const updated = await updateWorkspace(workspace._id, {
          name: name.trim(),
          description: description.trim(),
          sessionIds: selectedIds,
        });
        onUpdated(updated);
      } else {
        const created = await createWorkspace({
          name: name.trim(),
          description: description.trim(),
          sessionIds: selectedIds,
        });
        onCreated(created);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
        {workspace ? 'Edit Workspace' : 'Create Workspace'}
      </h2>

      {error && (
        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.375rem' }}>
          Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Q1 2024 Analysis"
          style={{
            width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-hover)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.375rem' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="Optional — describe what this workspace covers"
          rows={2}
          style={{
            width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-hover)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          Select Statements ({selectedIds.length} selected)
        </label>
        <div style={{
          maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-hover)',
        }}>
          {sessions.length === 0 && (
            <p style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
              No statements uploaded yet.
            </p>
          )}
          {sessions.map(s => (
            <label
              key={s._id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem',
                cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: selectedIds.includes(s._id) ? 'rgba(99,102,241,0.08)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(s._id)}
                onChange={() => toggleSession(s._id)}
                style={{ accentColor: 'var(--primary)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500 }}>
                  {s.filename}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                  {s.rowCount} rows · {s.fileType} · {new Date(s.uploadedAt).toLocaleDateString()}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button type="button" className="ghost-btn" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Saving...' : workspace ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}
