/**
 * Room Scan API Module.
 *
 * Endpoints:
 *   POST /v1/scan/image      — analyse a room photo (base64)
 *   POST /v1/scan/dimensions  — analyse from manual measurements
 *   POST /v1/scan/estimate    — scan + price estimate combo
 *
 * @module api/roomScanApi
 */

import client from './client';

/**
 * Analyse a room image and return size/clutter estimates.
 *
 * @param {string} imageBase64 - Base64-encoded JPEG/PNG (with or without data-URI prefix)
 * @param {number} [widthHint]  - Camera resolution width in px
 * @param {number} [heightHint] - Camera resolution height in px
 * @returns {Promise<{data: {estimated_area, room_size, clutter_level, clutter_score, price_modifier, confidence, analysis_mode, details}|null, error: string|null}>}
 */
export const scanImage = (imageBase64, widthHint = null, heightHint = null) =>
  client.post('/scan/image', {
    image_base64: imageBase64,
    width_hint: widthHint,
    height_hint: heightHint,
  });

/**
 * Analyse a room from manual width/length measurements.
 *
 * @param {number} widthM   - Room width in metres
 * @param {number} lengthM  - Room length in metres
 * @param {number} [clutterScore=0.3] - Estimated clutter (0.0–1.0)
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export const scanDimensions = (widthM, lengthM, clutterScore = 0.3) =>
  client.post('/scan/dimensions', {
    width_m: widthM,
    length_m: lengthM,
    clutter_score: clutterScore,
  });

/**
 * Scan a room image AND get a price estimate in one call.
 *
 * @param {string} imageBase64 - Base64-encoded image
 * @param {Object} pricingParams
 * @param {string} pricingParams.serviceType
 * @param {number} pricingParams.rooms
 * @param {number} pricingParams.toilets
 * @param {Object} [pricingParams.extras]
 * @param {boolean} [pricingParams.useFixed=true]
 * @param {string} [pricingParams.surge='normal']
 * @param {number} [widthHint]
 * @param {number} [heightHint]
 * @returns {Promise<{data: {scan, price_estimate}|null, error: string|null}>}
 */
export const scanAndEstimate = (
  imageBase64,
  { serviceType, rooms = 1, toilets = 0, extras = {}, useFixed = true, surge = 'normal' } = {},
  widthHint = null,
  heightHint = null,
) =>
  client.post('/scan/estimate', {
    image_base64: imageBase64,
    width_hint: widthHint,
    height_hint: heightHint,
    service_type: serviceType,
    rooms,
    toilets,
    extras,
    use_fixed: useFixed,
    surge,
  });
