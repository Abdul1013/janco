/**
 * Payment API Module — Paystack integration.
 *
 * Endpoints:
 *   POST /v1/payments/initialize       — Create a Paystack transaction
 *   GET  /v1/payments/{reference}/verify — Verify a transaction manually
 *
 * @module api/paymentApi
 */

import client from './client';

/**
 * Initialize a Paystack transaction for a job.
 *
 * @param {string} jobId - The JANCO job ID to pay for.
 * @param {string} [callbackUrl] - URL to redirect to after web checkout.
 * @returns {Promise<{data: {authorization_url, access_code, reference}|null, error: string|null}>}
 */
export const initializePayment = (jobId, callbackUrl) =>
  client.post('/payments/initialize', {
    job_id: jobId,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  });

/**
 * Manually verify a Paystack transaction.
 * Use this if the webhook hasn't fired yet after returning from checkout.
 *
 * @param {string} reference - The Paystack transaction reference.
 * @returns {Promise<{data: {status, amount_naira, reference, job_id, paid_at}|null, error: string|null}>}
 */
export const verifyPayment = (reference) =>
  client.get(`/payments/${encodeURIComponent(reference)}/verify`);
