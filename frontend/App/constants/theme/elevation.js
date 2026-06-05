/**
 * JANCO Design Tokens — Elevation / Shadow
 *
 * Material Design 3 elevation levels mapped to React Native shadow
 * properties.  iOS uses shadow* props; Android uses the `elevation`
 * prop.  Spread the desired level into your View's style.
 *
 * Usage:
 *   import { Elevation } from '../constants/theme';
 *   <View style={[styles.card, Elevation.level2]} />
 *
 * @module theme/elevation
 */

import { Platform } from 'react-native';

/**
 * Build a cross-platform shadow style for a given elevation dp value.
 *
 * @param {number} dp - Material elevation in density-independent pixels
 * @returns {import('react-native').ViewStyle}
 */
function shadow(dp) {
  if (dp === 0) return {};

  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: dp * 0.5 },
      shadowOpacity: 0.08 + dp * 0.02,
      shadowRadius: dp * 0.8,
    },
    android: {
      elevation: dp,
    },
    default: {},
  });
}

/** @type {Record<string, import('react-native').ViewStyle>} */
export const Elevation = {
  /** Flat surface — no shadow */
  level0: shadow(0),
  /** Cards at rest (1dp) */
  level1: shadow(1),
  /** Elevated cards, FABs at rest (3dp) */
  level2: shadow(3),
  /** Modals, dialogs (6dp) */
  level3: shadow(6),
  /** Navigation drawers (8dp) */
  level4: shadow(8),
  /** Bottom sheets (12dp) */
  level5: shadow(12),
};

export default Elevation;
