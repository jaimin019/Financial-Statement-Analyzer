import axios, { type AxiosInstance, type AxiosError } from "axios";

const TOKEN_KEY = "fsa_token";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};
export const setToken = (t: string): void => {
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, t);
};
export const clearToken = (): void => {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
};

// Hook for 401 -> logout from the auth context
let on401Handler: (() => void) | null = null;
export const setOn401 = (fn: () => void) => { on401Handler = fn; };

export const api: AxiosInstance = axios.create({
  baseURL: "",
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["Authorization"] = `Bearer ${t}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && on401Handler) on401Handler();
    return Promise.reject(err);
  }
);

export const extractErrorMessage = (err: unknown): string => {
  const e = err as AxiosError<{ error?: string }>;
  if (!e.response) return "Cannot connect to server";
  if (e.response.status === 429) return "Too many requests, please wait a moment";
  if (e.response.status === 500) return "Something went wrong, please try again";
  return e.response.data?.error || "An unexpected error occurred";
};

// ---------- Auth ----------
export interface AuthUser {
  email: string;
  createdAt: string;
  lastLoginAt?: string;
  isAdmin?: boolean;
  avatarUrl?: string;
  displayName?: string;
}

export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>("/api/auth/register", { email, password }).then(r => r.data),
  login: (email: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>("/api/auth/login", { email, password }).then(r => r.data),
  logout: () => api.post("/api/auth/logout").catch(() => null),
  me: () => api.get<AuthUser>("/api/auth/me").then(r => r.data),
  waitlist: (email: string) =>
    api.post<{ message: string }>("/api/auth/waitlist", { email }).then(r => r.data),
};

// ---------- Sessions ----------
export interface SessionObj {
  sessionId: string;
  filename: string;
  fileType: string;
  sourceFormat: "csv" | "pdf";
  rowCount: number;
  columnHeaders: string[];
  status: "processing" | "ready" | "error";
  errorMessage: string | null;
  uploadedAt: string;
  lastActiveAt: string;
  messageCount: number;
  lastMessage: { role: string; content: string; timestamp: string } | null;
  workspaceIds: string[];
  insights: InsightObj | null;
}

export interface InsightObj {
  summary: string;
  topCategories: { category: string; totalSpent: number; transactionCount: number; percentOfTotal: number }[];
  largestExpense: { amount: number; merchantName: string; date: string; rowIndex: number };
  recurringMerchants: { merchantName: string; count: number; totalSpent: number; avgAmount: number }[];
  incomeVsExpense: { totalIncome: number; totalExpense: number; netFlow: number };
  unusualTransactions: { amount: number; merchantName: string; date: string; rowIndex: number; zScore: number }[];
  dateRange: { start: string; end: string; daysSpanned: number };
  generatedAt: string;
}

export interface RawTransaction {
  rowIndex: number;
  rawData: Record<string, unknown>;
  normalizedDate: string;
  normalizedAmount: number;
  direction: "debit" | "credit" | "buy" | "sell";
  merchantName: string;
  category: string;
}

export const sessionApi = {
  list: () => api.get<{ sessions: SessionObj[] }>("/api/sessions").then(r => r.data.sessions),
  get: (sessionId: string) =>
    api.get<SessionObj>(`/api/upload/sessions/${sessionId}`).then(r => r.data),
  delete: (sessionId: string) =>
    api.delete<{ message: string }>(`/api/sessions/${sessionId}`).then(r => r.data),
  jobStatus: (sessionId: string) =>
    api.get<{ status: string; progress?: number; errorMessage?: string; jobId?: string }>(
      `/api/sessions/${sessionId}/job-status`
    ).then(r => r.data),
  insights: (sessionId: string) =>
    api.get(`/api/sessions/${sessionId}/insights`, { validateStatus: () => true }).then(r => ({
      status: r.status,
      data: r.data as InsightObj | { status: string },
    })),
  messages: (sessionId: string, page = 1, limit = 50) =>
    api.get<{
      messages: { role: "user" | "assistant"; content: string; timestamp: string; citedRows: number[] }[];
      pagination: { page: number; limit: number; total: number; hasMore: boolean };
    }>(`/api/sessions/${sessionId}/messages`, { params: { page, limit } }).then(r => r.data),
  rows: (sessionId: string, indexes: number[]) =>
    api.get<{ rows: RawTransaction[] }>(`/api/sessions/${sessionId}/rows`, {
      params: { indexes: indexes.join(",") }
    }).then(r => r.data.rows),
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{
      sessionId: string; filename: string; fileType: string;
      rowCount: number; chunkCount: number; status: string; jobId: string;
    }>("/api/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then(r => r.data);
  },
  generateReport: (sessionId: string) =>
    api.post(`/api/reports/${sessionId}/generate`, null, { responseType: "blob" }).then(r => r.data as Blob),
};

// ---------- Workspaces ----------
export interface Workspace {
  _id: string;
  name: string;
  description: string;
  sessionIds: string[];
  sessions: SessionObj[];
  messageCount: number;
  lastMessage: { role: string; content: string; timestamp: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const workspaceApi = {
  list: () => api.get<{ workspaces: Workspace[] }>("/api/workspaces").then(r => r.data.workspaces),
  get: (id: string) => api.get<Workspace>(`/api/workspaces/${id}`).then(r => r.data),
  create: (data: { name: string; description?: string; sessionIds?: string[] }) =>
    api.post<Workspace>("/api/workspaces", data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; sessionIds: string[] }>) =>
    api.patch<Workspace>(`/api/workspaces/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete<{ message: string }>(`/api/workspaces/${id}`).then(r => r.data),
  addSession: (id: string, sessionId: string) =>
    api.post<Workspace>(`/api/workspaces/${id}/sessions`, { sessionId }).then(r => r.data),
  removeSession: (id: string, sessionId: string) =>
    api.delete<Workspace>(`/api/workspaces/${id}/sessions/${sessionId}`).then(r => r.data),
  messages: (id: string, page = 1, limit = 50) =>
    api.get(`/api/workspaces/${id}/messages`, { params: { page, limit } }).then(r => r.data),
};

// ---------- Analytics ----------
export const analyticsApi = {
  overview: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get("/api/analytics/overview", { params: scope }).then(r => r.data),
  byCategory: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get<{ categories: { category: string; totalSpent: number; transactionCount: number; percentOfTotal: number; avgTransactionSize: number }[] }>(
      "/api/analytics/by-category", { params: scope }
    ).then(r => r.data),
  byMonth: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get<{ months: { month: string; label: string; totalIncome: number; totalExpense: number; netFlow: number; transactionCount: number }[] }>(
      "/api/analytics/by-month", { params: scope }
    ).then(r => r.data),
  byMerchant: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get<{ merchants: { merchantName: string; totalSpent: number; transactionCount: number; avgAmount: number; category: string }[] }>(
      "/api/analytics/by-merchant", { params: scope }
    ).then(r => r.data),
  trends: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get<{ weeks: { weekLabel: string; totalSpend: number; transactionCount: number }[] }>(
      "/api/analytics/trends", { params: scope }
    ).then(r => r.data),
  portfolioSummary: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get("/api/analytics/portfolio-summary", { params: scope }).then(r => r.data),
  symbolPnL: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get("/api/analytics/symbol-pnl", { params: scope }).then(r => r.data),
  fundPerformance: (scope: { sessionId?: string; workspaceId?: string }) =>
    api.get("/api/analytics/fund-performance", { params: scope }).then(r => r.data),
};

// ---------- Admin ----------
export const adminApi = {
  stats: () => api.get("/api/admin/stats").then(r => r.data),
  users: (params: { page?: number; limit?: number; search?: string }) =>
    api.get("/api/admin/users", { params }).then(r => r.data),
  deleteUser: (userId: string) =>
    api.delete(`/api/admin/users/${userId}`).then(r => r.data),
  sessions: () => api.get("/api/admin/sessions").then(r => r.data),
};

export const startGoogleOAuth = () => {
  if (typeof window !== "undefined") {
    window.location.href = "/api/auth/google";
  }
};
