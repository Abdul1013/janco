/**
 * useChat Hook — manages chat state for a job.
 *
 * Connects to /v1/chat/ws/{jobId} using the backend's first-message
 * authentication protocol:
 *   1. WebSocket connects (no token in URL — tokens in URLs are logged by proxies)
 *   2. Hook sends {"type": "auth", "token": "<access_token>"} as first message
 *   3. Backend responds {"type": "auth_ok"} before entering the message loop
 *
 * Reconnection: exponential backoff (1s → 2s → 4s → … → 30s cap) on
 * unexpected close or error. The backoff timer is cleared on clean unmount.
 *
 * Returns: { messages, sendMessage, loadMore, loading, connected }
 *
 * @module hooks/useChat
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as chatApi from '../../api/chatApi';
import { WS_BASE_URL } from '../../api/config';
import useAuthStore from '../store/authStore';

const MAX_RECONNECT_DELAY_MS = 30_000;

export default function useChat(jobId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [cursor, setCursor] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(1000);
  const unmountedRef = useRef(false);

  const tokens = useAuthStore((s) => s.tokens);

  // ── Load initial message history ──────────────────────────────────────────

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

  // ── WebSocket connection ──────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (unmountedRef.current || !jobId || !tokens?.access) return;

    // Clean up any existing connection before opening a new one
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect loop on intentional close
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_BASE_URL}/chat/ws/${jobId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      // First-message auth: send token in body, not in URL
      ws.send(JSON.stringify({ type: 'auth', token: tokens.access }));
      // Reset reconnect delay on successful connection
      reconnectDelayRef.current = 1000;
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'auth_ok') {
          setConnected(true);
        } else if (msg.type === 'message') {
          setMessages((prev) => [...prev, msg.data]);
        }
        // "error" frames from server are ignored — reconnect will handle them
      } catch {
        // malformed frame — ignore
      }
    };

    const scheduleReconnect = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — reconnect there
    };

    ws.onclose = (event) => {
      if (unmountedRef.current) return;
      setConnected(false);
      // code 1000 = normal closure (we closed it) — do not reconnect
      if (event.code !== 1000) {
        scheduleReconnect();
      }
    };
  }, [jobId, tokens?.access]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!jobId || !tokens?.access) return;

    unmountedRef.current = false;
    loadMessages();
    connect();

    return () => {
      unmountedRef.current = true;
      // Clear pending reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Clean close (code 1000 — suppresses reconnect in onclose handler)
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close(1000, 'component unmounted');
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [jobId, tokens?.access, loadMessages, connect]);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || !jobId) return { data: null, error: 'No content' };

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ content: content.trim() }));
        return { data: true, error: null };
      }

      // HTTP fallback (WS not connected or mid-reconnect)
      return chatApi.sendMessage(jobId, content.trim());
    },
    [jobId],
  );

  return { messages, sendMessage, loadMore, loading, connected };
}
