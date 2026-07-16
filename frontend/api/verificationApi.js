/**
 * Verification API Module.
 *
 * Endpoints:
 *   POST /v1/verification/initiate  — submit NIN/BVN for lookup
 *   POST /v1/verification/liveness  — submit selfie for liveness check
 *   GET  /v1/verification/status    — check verification status
 *
 * @module api/verificationApi
 */

import client from './client';

/**
 * Step 1: Initiate identity verification with NIN or BVN.
 * @param {string} idType - "nin" or "bvn"
 * @param {string} idNumber - The government-issued ID number
 * @returns {Promise<{data: {dojah_ref, status, message}|null, error: string|null}>}
 */
export const initiateVerification = (idType, idNumber) =>
  client.post('/verification/initiate', { id_type: idType, id_number: idNumber });

/**
 * Step 2: Submit selfie for liveness detection.
 * @param {string} imageBase64 - Base64-encoded selfie image
 * @returns {Promise<{data: {status, message}|null, error: string|null}>}
 */
export const submitLiveness = (imageBase64) =>
  client.post('/verification/liveness', { image_base64: imageBase64 });

/**
 * Step 3: Check current verification status.
 * @returns {Promise<{data: {status, dojah_ref, verified_at, retries_left}|null, error: string|null}>}
 */
export const getVerificationStatus = () =>
  client.get('/verification/status');
