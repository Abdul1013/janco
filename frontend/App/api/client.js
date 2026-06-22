/**
 * JANCO API Client
 *
 * Configured fetch wrapper that every API module uses. Handles:
 *  - JWT injection from auth store
 *  - Automatic 401 → token refresh → retry
 *  - Exponential backoff retry on 5xx / network failures
 *  - Request timeouts
 *  - Returns { data, error } tuple — never throws
 *
 * Usage:
 *   import client from '../api/client';
 *   const { data, error } = await client.get('/bookings');
 *   const { data, error } = await client.post('/pricing/estimate', body);
 *
 * @module api/client
 */

import { API_BASE_URL, REQUEST_TIMEOUT, UPLOAD_TIMEOUT, RETRY } from './config';

// ---------------------------------------------------------------------------
// Token accessor — lazily imported to avoid circular deps with authStore
// ---------------------------------------------------------------------------
let _getTokens = null;
let _refreshToken = null;

/**
 * Register the auth store's token functions.
 * Called once from authStore.js after store creation.
 *
 * @param {() => {access: string|null, refresh: string|null}} getTokens
 * @param {() => Promise<string>} refreshFn
 */
export function registerAuthHandlers(getTokens, refreshFn) {
  _getTokens = getTokens;
  _refreshToken = refreshFn;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for ms milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Execute a single fetch with timeout.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeout
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Core request function with retry and token refresh.
 *
 * @param {string} method   - HTTP method
 * @param {string} path     - Relative path (e.g. '/bookings')
 * @param {Object} [body]   - JSON body (for POST/PATCH)
 * @param {Object} [opts]   - { timeout, isUpload }
 * @returns {Promise<{ data: any, error: string|null }>}
 */
async function request(method, path, body = null, opts = {}) {
  const url = `${API_BASE_URL}${path}`;
  const timeout = opts.timeout ?? (opts.isUpload ? UPLOAD_TIMEOUT : REQUEST_TIMEOUT);

  const headers = { 'Content-Type': 'application/json' };

  // Inject JWT if available
  if (_getTokens) {
    const tokens = _getTokens();
    if (tokens?.access) {
      headers['Authorization'] = `Bearer ${tokens.access}`;
    }
  }

  const fetchOpts = {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  let lastError = null;

  for (let attempt = 0; attempt < RETRY.maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, fetchOpts, timeout);

      // 401 — try refreshing the token once, then retry
      if (res.status === 401 && attempt === 0 && _refreshToken) {
        try {
          const newToken = await _refreshToken();
          headers['Authorization'] = `Bearer ${newToken}`;
          fetchOpts.headers = headers;
          // Retry immediately (don't count against backoff)
          const retryRes = await fetchWithTimeout(url, fetchOpts, timeout);
          if (retryRes.ok) return { data: await retryRes.json(), error: null };
          return { data: null, error: `HTTP ${retryRes.status}` };
        } catch {
          return { data: null, error: 'Session expired. Please log in again.' };
        }
      }

      // 4xx (non-401) — don't retry; it's a client error
      if (res.status >= 400 && res.status < 500) {
        const errBody = await res.json().catch(() => ({}));
        return {
          data: null,
          error: errBody?.error?.message ?? errBody?.detail ?? `HTTP ${res.status}`,
        };
      }

      // 5xx — retry with backoff
      if (res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        await sleep(RETRY.baseDelayMs * 2 ** attempt);
        continue;
      }

      // 2xx — success
      const data = res.status === 204 ? null : await res.json();
      return { data, error: null };
    } catch (err) {
      // Network / timeout error — retry with backoff
      lastError = err.name === 'AbortError' ? 'Request timed out' : 'Network error';
      if (attempt < RETRY.maxAttempts - 1) {
        await sleep(RETRY.baseDelayMs * 2 ** attempt);
      }
    }
  }

  return { data: null, error: lastError ?? 'Unknown error' };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const client = {
  /**
   * GET request.
   * @param {string} path
   * @returns {Promise<{ data: any, error: string|null }>}
   */
  get: (path) => request('GET', path),

  /**
   * POST request.
   * @param {string} path
   * @param {Object} body
   * @returns {Promise<{ data: any, error: string|null }>}
   */
  post: (path, body) => request('POST', path, body),

  /**
   * PATCH request.
   * @param {string} path
   * @param {Object} body
   * @returns {Promise<{ data: any, error: string|null }>}
   */
  patch: (path, body) => request('PATCH', path, body),

  /**
   * DELETE request.
   * @param {string} path
   * @returns {Promise<{ data: any, error: string|null }>}
   */
  del: (path) => request('DELETE', path),
};

export default client;
