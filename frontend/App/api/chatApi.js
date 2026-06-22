/**
 * Chat API Module.
 *
 * Endpoints:
 *   POST /v1/chat/:jobId/messages — send message
 *   GET  /v1/chat/:jobId/messages — paginated messages
 *
 * @module api/chatApi
 */

import client from './client';

/**
 * Send a message in a job chat.
 * @param {string} jobId
 * @param {string} content - Message text
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const sendMessage = (jobId, content) =>
  client.post(`/chat/${jobId}/messages`, { content });

/**
 * Get paginated messages for a job.
 * @param {string} jobId
 * @param {string} [cursor] - ISO timestamp cursor for pagination
 * @param {number} [limit=50]
 * @returns {Promise<{data: {messages, next_cursor}|null, error: string|null}>}
 */
export const getMessages = (jobId, cursor = '', limit = 50) => {
  let path = `/chat/${jobId}/messages?limit=${limit}`;
  if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
  return client.get(path);
};
