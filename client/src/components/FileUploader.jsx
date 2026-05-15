import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadCSV } from '../services/api.js';
import SessionBadge from './SessionBadge.jsx';

/**
 * File upload view with drag-and-drop zone, progress bar, and status feedback.
 */
export default function FileUploader({ onSessionReady }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError('');
    setStatus('Uploading file...');

    try {
      const data = await uploadCSV(file, (p) => setProgress(p * 0.1)); // 0-10% for upload
      
      if (data.status === 'ready') {
        setStatus('');
        onSessionReady(data);
        return;
      }

      if (data.jobId) {
        setStatus('Generating AI embeddings...');
        let isDone = false;
        
        while (!isDone) {
          await new Promise((r) => setTimeout(r, 2000)); // Poll every 2s
          try {
            const { getJobStatus } = await import('../services/api.js');
            const jobData = await getJobStatus(data.jobId);
            
            if (jobData.state === 'completed') {
              setProgress(100);
              setStatus('Ready!');
              isDone = true;
              onSessionReady({ ...data, status: 'ready' });
            } else if (jobData.state === 'failed') {
              throw new Error('Background processing failed');
            } else {
              const currentProgress = jobData.progress || 0;
              setProgress(10 + (currentProgress * 0.9)); // Map 0-100 to 10-100%
              if (currentProgress > 70) setStatus('Building financial insights...');
              else setStatus('Generating AI embeddings...');
            }
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
            // Continue polling unless it's a hard error we want to fail on
          }
        }
      } else {
        // Fallback if no jobId but status is processing (shouldn't happen with updated backend)
        setStatus('Processing...');
        onSessionReady(data);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      setError(msg);
      setStatus('');
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="upload-page">
      <h1>FinSight AI</h1>
      <p className="subtitle">
        Upload your bank statement or trading log to get AI-powered insights,
        spending analysis, and natural language queries over your financial data.
      </p>

      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="icon">📄</div>
        <div className="label">
          {isDragActive
            ? 'Drop your file here...'
            : 'Drop your bank statement here'}
        </div>
        <div className="hint">
          CSV or PDF from any Indian bank
        </div>
      </div>

      {file && (
        <div className="file-info">
          <span className="name">{file.name}</span>
          <span className="size">{formatSize(file.size)}</span>
        </div>
      )}

      {uploading && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {status && <p className="upload-status">{status}</p>}
      {error && <p className="upload-error">{error}</p>}

      <button
        className="upload-btn"
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? 'Analyzing...' : 'Analyze Statement'}
      </button>
    </div>
  );
}
