/**
 * Rating API Module.
 *
 * Endpoints:
 *   POST /v1/ratings              — submit rating for completed job
 *   GET  /v1/ratings/janitor/{id} — get janitor's rating summary
 *
 * @module api/ratingApi
 */

import client from './client';

/**
 * Submit a rating for a completed job.
 * @param {string} jobId - The completed job's ID
 * @param {number} score - Star rating (1-5)
 * @param {string} [comment=''] - Optional review comment
 * @returns {Promise<{data: {rating, trust_update}|null, error: string|null}>}
 */
export const submitRating = (jobId, score, comment = '') =>
  client.post('/ratings', { job_id: jobId, score, comment });

/**
 * Get a janitor's rating summary and paginated reviews.
 * @param {string} janitorId - The janitor's ID
 * @param {number} [page=1] - Page number
 * @param {number} [limit=20] - Reviews per page
 * @returns {Promise<{data: {janitor_id, avg_rating, total_ratings, ratings}|null, error: string|null}>}
 */
export const getJanitorRatings = (janitorId, page = 1, limit = 20) =>
  client.get(`/ratings/janitor/${janitorId}?page=${page}&limit=${limit}`);
