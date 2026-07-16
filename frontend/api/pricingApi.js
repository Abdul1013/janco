/**
 * Pricing API Module.
 *
 * Endpoint:
 *   POST /v1/pricing/estimate — get price estimate with breakdown
 *
 * @module api/pricingApi
 */

import client from './client';

/**
 * Get a price estimate from the backend pricing engine.
 *
 * @param {string} serviceType - house_cleaning|deep_cleaning|laundry|fumigation
 * @param {number} rooms
 * @param {number} toilets
 * @param {Object} [extras]
 * @param {number} [clothesCount=0]
 * @param {boolean} [useFixed=true] - ignored when useScan is true
 * @param {string} [surge='normal']
 * @param {number|null} [distanceKm=null] - janitor distance for transport fee
 * @param {boolean} [useScan=false] - use scan (area-based) pricing mode
 * @param {number|null} [areaM2=null] - scanned room area in m²
 * @returns {Promise<{data: {total, breakdown, mode, surge_multiplier, transport_fee}|null, error: string|null}>}
 */
export const estimatePrice = (
  serviceType,
  rooms = 1,
  toilets = 0,
  extras = {},
  clothesCount = 0,
  useFixed = true,
  surge = 'normal',
  distanceKm = null,
  useScan = false,
  areaM2 = null,
) =>
  client.post('/pricing/estimate', {
    service_type: serviceType,
    rooms,
    toilets,
    clothes_count: clothesCount,
    extras,
    use_fixed: useFixed,
    surge,
    distance_km: distanceKm,
    use_scan: useScan,
    area_m2: areaM2,
  });
