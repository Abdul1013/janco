/**
 * useChat Hook — manages chat state for a job.
 *
 * Replaces Supabase Realtime with a native WebSocket connection to
 * /v1/chat/ws/{jobId}?token=<access_token>.
 *
 * Returns: { messages, sendMessage, loadMore, loading }
 *
 * @module hooks/useChat
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as chatApi from '../api/chatApi';
import { WS_BASE_URL } from '../api/config';
import useAuthStore from '../store/authStore';

export default function useChat(jobId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const wsRef = useRef(null);
  const tokens = useAuthStore((s) => s.tokens);

  // Load initial message history
  const loadMessages = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    const { data, error } = await chatApi.getMessages(jobId);
    if (!error && data) {
      const list = data.messages || data;
      setMessages(Array.isArray(list) ? list : []);
      setCursor(data.next_cursor || null);
    }
    setLoading(false);
  }, [jobId]);

  // Load older messages (cursor-based pagination)
  const loadMore = useCallback(async () => {
    if (!cursor || !jobId) return;
    const { data, error } = await chatApi.getMessages(jobId, cursor);
    if (!error && data) {
      const older = data.messages || data;
      setMessages((prev) => [...(Array.isArray(older) ? older : []), ...prev]);
      setCursor(data.next_cursor || null);
    }
  }, [jobId, cursor]);

  // Open WebSocket and subscribe to live messages
  useEffect(() => {
    if (!jobId || !tokens?.access) return;

    loadMessages();

    const ws = new WebSocket(`${WS_BASE_URL}/chat/ws/${jobId}?token=${tokens.access}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'message') {
          setMessages((prev) => [...prev, msg.data]);
        }
      } catch {
        // malformed frame — ignore
      }
    };

    // Reconnection logic can be added here if needed for production
    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jobId, tokens?.access, loadMessages]);

  // Send a message — prefers the open WebSocket, falls back to HTTP
  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || !jobId) return;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ content: content.trim() }));
        return { data: true, error: null };
      }

      // HTTP fallback (WS not yet connected or closed)
      return chatApi.sendMessage(jobId, content.trim());
    },
    [jobId],
  );

  return { messages, sendMessage, loadMore, loading };
}
