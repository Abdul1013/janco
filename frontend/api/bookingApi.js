/**
 * Booking API Module.
 *
 * Endpoints:
 *   POST  /v1/bookings            — create booking
 *   GET   /v1/bookings            — list my bookings (paginated)
 *   GET   /v1/bookings/:id        — get single booking
 *   PATCH /v1/bookings/:id/status — update status
 *   POST  /v1/bookings/:id/cancel — cancel booking
 *
 * @module api/bookingApi
 */

import client from './client';

/**
 * Create a new booking.
 * @param {Object} data - { service_type, rooms, toilets, extras, scheduled_date, scheduled_time, address, latitude, longitude, janitor_id?, notes? }
 * @returns {Promise<{data: {message, job}|null, error: string|null}>}
 */
export const createBooking = (data) => client.post('/bookings', data);

/**
 * Get a single booking by ID.
 * @param {string} id
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const getBooking = (id) => client.get(`/bookings/${id}`);

/**
 * List current user's bookings with optional status filter.
 * @param {number} [page=1]
 * @param {string} [status] - Optional status filter
 * @returns {Promise<{data: {jobs, count, page, limit}|null, error: string|null}>}
 */
export const getUserBookings = (page = 1, status = '') => {
  let path = `/bookings?page=${page}`;
  if (status) path += `&status=${status}`;
  return client.get(path);
};

/**
 * Update a booking's status.
 * @param {string} id
 * @param {string} newStatus - pending|confirmed|in_progress|completed|cancelled
 * @returns {Promise<{data: {message, job}|null, error: string|null}>}
 */
export const updateStatus = (id, newStatus) =>
  client.patch(`/bookings/${id}/status`, { new_status: newStatus });

/**
 * Cancel a booking.
 * @param {string} id
 * @returns {Promise<{data: {message, job}|null, error: string|null}>}
 */
export const cancelBooking = (id) => client.post(`/bookings/${id}/cancel`);

/**
 * Janitor accepts a pending job assigned to them (→ confirmed).
 * @param {string} id
 * @returns {Promise<{data: {message, job}|null, error: string|null}>}
 */
export const acceptJob = (id) => client.post(`/bookings/${id}/accept`);

/**
 * Janitor rejects a pending job; it is unassigned for re-matching.
 * @param {string} id
 * @returns {Promise<{data: {message, job}|null, error: string|null}>}
 */
export const rejectJob = (id) => client.post(`/bookings/${id}/reject`);

/**
 * List jobs assigned to the current janitor (janitor_id = me).
 * @param {number} [page=1]
 * @param {string} [status] - Optional exact status filter
 * @returns {Promise<{data: {jobs, count, page, limit}|null, error: string|null}>}
 */
export const getAssignedJobs = (page = 1, status = '') => {
  let path = `/bookings/assigned?page=${page}`;
  if (status) path += `&status=${status}`;
  return client.get(path);
};
