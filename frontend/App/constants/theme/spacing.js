/**
 * JANCO Design Tokens — Spacing Scale
 *
 * 4px base grid aligned with Material Design 3. Every spacing value is
 * a multiple of 4, producing predictable, consistent layouts across
 * device sizes without the rounding artefacts of the old normalizeSpace
 * utility.
 *
 * Usage:
 *   import { Spacing } from '../constants/theme';
 *   paddingHorizontal: Spacing.base  // 16
 *
 * @module theme/spacing
 */

/** @type {Record<string, number>} */
export const Spacing = {
  /** 4px — hairline gaps, icon padding */
  xs: 4,
  /** 8px — tight inner padding, list-item gaps */
  sm: 8,
  /** 12px — compact card padding */
  md: 12,
  /** 16px — default screen/card padding */
  base: 16,
  /** 20px — comfortable gap between sections */
  lg: 20,
  /** 24px — section dividers */
  xl: 24,
  /** 32px — large section spacing */
  xxl: 32,
  /** 40px — screen-level vertical margins */
  xxxl: 40,
  /** 48px — minimum touch-target size (Apple HIG / MD3) */
  touchTarget: 48,
};

export default Spacing;
