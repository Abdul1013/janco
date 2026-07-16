/**
 * Auth API Module.
 *
 * Endpoints:
 *   POST /v1/auth/signup   — { email, password, full_name }
 *   POST /v1/auth/login    — { email, password }
 *   POST /v1/auth/refresh  — refresh_token query param
 *   GET  /v1/auth/me       — (protected)
 *   PATCH /v1/auth/profile — (protected) { full_name?, phone?, avatar_url? }
 *   POST /v1/auth/logout   — (protected)
 *
 * @module api/authApi
 */

import client from './client';

/**
 * Create a new account.
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @param {boolean} acceptedTerms — must be true; user agreed to Terms & Privacy.
 * @returns {Promise<{data: {user_id, access_token, refresh_token}|null, error: string|null}>}
 */
export const signup = (email, password, fullName, acceptedTerms = false) =>
  client.post('/auth/signup', {
    email,
    password,
    full_name: fullName,
    accepted_terms: acceptedTerms,
  });

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data: {access_token, refresh_token, user}|null, error: string|null}>}
 */
export const login = (email, password) =>
  client.post('/auth/login', { email, password });

/**
 * Exchange a refresh token for a new JWT.
 * @param {string} refreshToken
 * @returns {Promise<{data: {access_token, refresh_token}|null, error: string|null}>}
 */
export const refreshToken = (refreshToken) =>
  client.post('/auth/refresh', { refresh_token: refreshToken });

/**
 * Get the current user's profile.
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const getProfile = () => client.get('/auth/me');

/**
 * Update profile fields.
 * @param {{ full_name?: string, phone?: string, avatar_url?: string }} data
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const updateProfile = (data) => client.patch('/auth/profile', data);

/**
 * Request a password reset email.
 * @param {string} email
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const requestPasswordReset = (email) =>
  client.post('/auth/reset-password', { email });

/**
 * Confirm a password reset using the token from the email.
 * @param {string} token - Reset token
 * @param {string} newPassword - New password to set
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const confirmPasswordReset = (token, newPassword) =>
  client.post('/auth/reset-password/confirm', { token, new_password: newPassword });

/**
 * Update the current user's password (protected).
 * @param {string} password
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const updatePassword = (password) =>
  client.post('/auth/update-password', { password });

/**
 * Log out (invalidate session).
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const logout = () => client.post('/auth/logout');
