/**
 * API Configuration
 *
 * Centralises all environment-dependent values. In production, these
 * should come from Expo's Constants.expoConfig.extra or environment
 * variables.  The fallbacks here are for local development.
 *
 * @module api/config
 */

/** Base URL for the JANCO FastAPI backend (no trailing slash). */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://176.2.3.1:8000/v1';

/** WebSocket base URL for live chat (ws:// or wss:// in production). */
export const WS_BASE_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? 'ws://176.2.3.1:8000/v1';
/** Request timeout in milliseconds (30s for uploads, 10s for everything else). */
export const REQUEST_TIMEOUT = 10_000;
export const UPLOAD_TIMEOUT = 30_000;

/** Retry configuration for 5xx and network errors. */
export const RETRY = {
  maxAttempts: 3,
  baseDelayMs: 1_000, // 1s → 2s → 4s (exponential)
};
