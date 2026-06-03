import { useCallback, useRef, useState } from "react";
import { getToken } from "@/lib/api";

export interface SSECallbacks {
  onStatus?: (msg: string) => void;
  onToken?: (token: string) => void;
  onCitations?: (data: { citedRowIndexes: unknown[]; sourceTransactions: unknown[] }) => void;
  onChart?: (chartData: unknown) => void;
  onDone?: (data: { sessionId?: string }) => void;
  onError?: (message: string) => void;
}

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (endpoint: string, body: unknown, cb: SSECallbacks) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setIsStreaming(true);

    try {
      const token = getToken();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        let msg = "Failed to send message";
        try { msg = JSON.parse(text).error || msg; } catch { /* ignore */ }
        cb.onError?.(msg);
        setError(msg);
        setIsStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            let data: Record<string, unknown> = {};
            try { data = JSON.parse(dataStr); } catch { continue; }
            switch (currentEvent) {
              case "status": cb.onStatus?.(String(data.message ?? "")); break;
              case "token": cb.onToken?.(String(data.token ?? "")); break;
              case "citations": cb.onCitations?.(data as never); break;
              case "chart": cb.onChart?.(data.chartData); break;
              case "done": cb.onDone?.(data as never); break;
              case "error": cb.onError?.(String(data.message ?? "Error")); break;
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = "Connection lost. Please try again.";
      cb.onError?.(msg);
      setError(msg);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { sendMessage, isStreaming, error, cancel };
}
