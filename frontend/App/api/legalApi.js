/**
 * Legal API Module.
 *
 * Fetches the current Terms & Conditions and Privacy Policy (Markdown) from
 * the public backend endpoints. No auth required.
 *
 *   GET /v1/legal/terms    — { doc_type, version, content_md }
 *   GET /v1/legal/privacy  — { doc_type, version, content_md }
 *
 * @module api/legalApi
 */

import client from './client';

/**
 * @param {'terms'|'privacy'} docType
 * @returns {Promise<{data: {doc_type, version, content_md}|null, error: string|null}>}
 */
export const getLegalDoc = (docType) => client.get(`/legal/${docType}`);
