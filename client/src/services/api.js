import axios from 'axios';

// ── Axios interceptors ────────────────────────────────────────
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('fsa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fsa_token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────

export async function apiLogin(email, password) {
  const res = await axios.post('/api/auth/login', { email, password });
  return res.data;
}

export async function apiRegister(email, password) {
  const res = await axios.post('/api/auth/register', { email, password });
  return res.data;
}

export async function apiLogout() {
  await axios.post('/api/auth/logout').catch(() => {});
}

// ── Sessions ──────────────────────────────────────────────────

export async function uploadCSV(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data;
}

export async function getSession(sessionId) {
  const res = await axios.get(`/api/upload/sessions/${sessionId}`);
  return res.data;
}

export async function listSessions() {
  const res = await axios.get('/api/upload/sessions');
  return res.data;
}

export async function getJobStatus(jobId) {
  const res = await axios.get(`/api/upload/job-status/${jobId}`);
  return res.data;
}

export async function fetchRows(sessionId, rowIndexes) {
  const res = await axios.get(
    `/api/sessions/${sessionId}/rows?indexes=${rowIndexes.join(',')}`
  );
  return res.data;
}

// ── Week 5: Messages + Insights ──────────────────────────────

export async function getSessionMessages(sessionId, page = 1, limit = 50) {
  const res = await axios.get(
    `/api/upload/${sessionId}/messages?page=${page}&limit=${limit}`
  );
  return res.data;
}

export async function getSessionInsights(sessionId) {
  const res = await axios.get(`/api/upload/${sessionId}/insights`);
  return res.data;
}

// ── Week 8: Session Deletion ────────────────────────────────

export async function deleteSession(sessionId) {
  const res = await axios.delete(`/api/upload/sessions/${sessionId}`);
  return res.data;
}

export async function apiGetAdminStats() {
  const res = await axios.get('/api/admin/stats');
  return res.data;
}

// ── Week 10: Workspaces ─────────────────────────────────────

export async function listWorkspaces() {
  const res = await axios.get('/api/workspaces');
  return res.data;
}

export async function getWorkspace(workspaceId) {
  const res = await axios.get(`/api/workspaces/${workspaceId}`);
  return res.data;
}

export async function createWorkspace(data) {
  const res = await axios.post('/api/workspaces', data);
  return res.data;
}

export async function updateWorkspace(workspaceId, data) {
  const res = await axios.patch(`/api/workspaces/${workspaceId}`, data);
  return res.data;
}

export async function deleteWorkspace(workspaceId) {
  const res = await axios.delete(`/api/workspaces/${workspaceId}`);
  return res.data;
}

export async function addSessionToWorkspace(workspaceId, sessionId) {
  const res = await axios.post(`/api/workspaces/${workspaceId}/sessions`, { sessionId });
  return res.data;
}

export async function removeSessionFromWorkspace(workspaceId, sessionId) {
  const res = await axios.delete(`/api/workspaces/${workspaceId}/sessions/${sessionId}`);
  return res.data;
}

// ── Week 10: Analytics ──────────────────────────────────────

export async function getAnalyticsOverview(params = {}) {
  const res = await axios.get('/api/analytics/overview', { params });
  return res.data;
}

export async function getAnalyticsByCategory(params = {}) {
  const res = await axios.get('/api/analytics/by-category', { params });
  return res.data;
}

export async function getAnalyticsByMonth(params = {}) {
  const res = await axios.get('/api/analytics/by-month', { params });
  return res.data;
}

export async function getAnalyticsByMerchant(params = {}) {
  const res = await axios.get('/api/analytics/by-merchant', { params });
  return res.data;
}

export async function getAnalyticsTrends(params = {}) {
  const res = await axios.get('/api/analytics/trends', { params });
  return res.data;
}

// ── Week 11: Investment Analytics ────────────────────────────

export async function getPortfolioSummary(params = {}) {
  const res = await axios.get('/api/analytics/portfolio-summary', { params });
  return res.data;
}

export async function getSymbolPnL(params = {}) {
  const res = await axios.get('/api/analytics/symbol-pnl', { params });
  return res.data;
}

export async function getFundPerformance(params = {}) {
  const res = await axios.get('/api/analytics/fund-performance', { params });
  return res.data;
}
