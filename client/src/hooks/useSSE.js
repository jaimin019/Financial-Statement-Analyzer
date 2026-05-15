import { useState, useCallback } from 'react';

/**
 * Hook for managing SSE connections to POST /api/chat.
 * Uses fetch + ReadableStream (not EventSource) to support POST body.
 *
 * @returns {{ sendMessage: Function, isStreaming: boolean, error: string|null }}
 */
export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (sessionId, question, chatHistory, callbacks) => {
    setIsStreaming(true);
    setError(null);

    try {
      const token = localStorage.getItem('fsa_token');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ sessionId, question, chatHistory }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case 'status':
                  callbacks.onStatus?.(data.message);
                  break;
                case 'token':
                  callbacks.onToken?.(data.token);
                  break;
                case 'citations':
                  callbacks.onCitations?.(data);
                  break;
                case 'chart':
                  callbacks.onChart?.(data.chartData);
                  break;
                case 'done':
                  callbacks.onDone?.();
                  break;
                case 'error':
                  callbacks.onError?.(data.message);
                  setError(data.message);
                  break;
              }
            } catch {
              // ignore JSON parse errors for incomplete data
            }
          }
        }
      }
    } catch (err) {
      const msg = err.message || 'Connection failed';
      setError(msg);
      callbacks.onError?.(msg);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { sendMessage, isStreaming, error };
}
