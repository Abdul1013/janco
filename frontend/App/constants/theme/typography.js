/**
 * JANCO Design Tokens — Typography Scale
 *
 * Follows the Material Design 3 type scale.
 * Headings (display/headline) → Chewy-Regular
 * Body/title/label text       → Quicksand (Regular / Medium / Bold)
 *
 * Usage:
 *   import { TypeScale } from '../constants/theme';
 *   <Text style={TypeScale.bodyLarge}>Hello</Text>
 *
 * @module theme/typography
 */

// Headings use Chewy-Regular; body/label/title text uses Quicksand variants.
const fontHeading = 'Chewy';
const fontText = 'Quicksand';
const fontTextMedium = 'QuicksandMedium';
const fontTextBold = 'QuicksandBold';

/**
 * MD3 type scale.
 * Each entry is a plain style object ready to spread into a <Text> style.
 *
 * @type {Record<string, import('react-native').TextStyle>}
 */
export const TypeScale = {
  displayLarge: {
    fontFamily: fontHeading,
    fontSize: 57,
    lineHeight: 64,
    letterSpacing: -0.25,
  },
  displayMedium: {
    fontFamily: fontHeading,
    fontSize: 45,
    lineHeight: 52,
    letterSpacing: 0,
  },
  displaySmall: {
    fontFamily: fontHeading,
    fontSize: 26,
    lineHeight: 44,
    letterSpacing: 0,
  },
  headlineLarge: {
    fontFamily: fontHeading,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontFamily: fontHeading,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontFamily: fontHeading,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
  },
  titleLarge: {
    fontFamily: fontTextBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
  },
  titleMedium: {
    fontFamily: fontTextMedium,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontFamily: fontTextMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  bodyLarge: {
    fontFamily: fontText,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  bodyMedium: {
    fontFamily: fontText,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontFamily: fontText,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  labelLarge: {
    fontFamily: fontTextMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: fontTextMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontFamily: fontTextMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
};

export default TypeScale;
