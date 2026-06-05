/**
 * JANCO Design Tokens — Colour Palette
 *
 * Brand: Lime-green (#CDDC39) primary, yellow (#FFEB3B) accent.
 * Follows MD3 colour roles so every token has a paired `on*` foreground
 * that guarantees WCAG AA contrast.
 *
 * Usage:
 *   import { Colors } from '../constants/theme';
 *   const bg = Colors.light.background;
 *   // or via hook:
 *   const { colors } = useTheme();
 *
 * @module theme/colors
 */

const palette = {
  // Lime — brand
  lime50:  '#F9FBE7',
  lime100: '#F0F4C3',   // light background / primaryContainer
  lime200: '#E6EE9C',
  lime300: '#DCE775',
  lime400: '#D4E157',
  lime500: '#CDDC39',   // primary
  lime600: '#C0CA33',
  lime700: '#AFB42B',   // secondary / darker brand
  lime800: '#9E9D24',
  lime900: '#827717',   // deep olive for dark text on lime

  // Yellow — accent / highlight
  yellow:  '#FFEB3B',
  yellowLight: '#FFFDE7',

  // Neutral
  white:   '#FFFFFF',
  black:   '#000000',
  grey50:  '#FAFAFA',
  grey100: '#F5F5F5',
  grey200: '#EEEEEE',
  grey300: '#E0E0E0',
  grey400: '#BDBDBD',
  grey500: '#9E9E9E',
  grey600: '#757575',
  grey700: '#616161',
  grey800: '#424242',
  grey850: '#2A2A2A',   // dark card background
  grey900: '#212121',
  grey950: '#121212',   // dark mode background

  // Card surfaces
  cardLight:  '#F7F8F2',  // off-white with a faint lime tint
  cardDark:   '#2A2A2A',

  // Semantic
  error:        '#D32F2F',
  errorLight:   '#FFCDD2',
  warning:      '#F9A825',
  warningLight: '#FFF9C4',
  info:         '#1565C0',
  infoLight:    '#BBDEFB',
  success:      '#2E7D32',
  successLight: '#C8E6C9',
};

/** @type {{ light: Record<string, string>, dark: Record<string, string> }} */
export const Colors = {
  light: {
    // ── Primary
    // Lime (#CDDC39) on dark text reads well (contrast ~7:1 on #212121)
    primary:              palette.lime500,
    onPrimary:            palette.grey900,        // dark text ON lime button
    primaryContainer:     palette.lime100,        // subtle lime tint for chips/cards
    onPrimaryContainer:   palette.lime900,        // deep olive text inside container

    // ── Secondary 
    secondary:            palette.lime700,        // darker lime for secondary actions
    onSecondary:          palette.white,
    secondaryContainer:   palette.lime200,
    onSecondaryContainer: palette.lime900,

    // ── Accent (yellow highlight)
    tertiary:             palette.yellow,
    onTertiary:           palette.grey900,
    tertiaryContainer:    palette.yellowLight,
    onTertiaryContainer:  palette.grey900,

    // ── Error ─
    error:                palette.error,
    onError:              palette.white,
    errorContainer:       palette.errorLight,
    onErrorContainer:     '#B71C1C',

    // ── Surfaces & Backgrounds
    background:           palette.lime100,        // #F0F4C3 — soft lime tint
    onBackground:         palette.grey900,        // #212121
    surface:              palette.cardLight,      // #F7F8F2 — card face
    onSurface:            palette.grey900,
    surfaceVariant:       palette.lime50,         // slightly lighter than background
    onSurfaceVariant:     palette.grey600,        // #757575 muted text
    surfaceDisabled:      palette.grey200,
    surfaceInverse:       palette.cardDark,       // dark element on light bg

    // ── Borders
    outline:              palette.lime700,        // #AFB42B — brand border
    outlineVariant:       palette.grey300,        // subtle divider

    // ── Inverse (snackbars, tooltips) ─
    inverseSurface:       palette.cardDark,
    inverseOnSurface:     palette.grey200,
    inversePrimary:       palette.lime300,

    // ── Utility
    shadow:               'rgba(0,0,0,0.08)',
    scrim:                palette.black,
    white:                palette.white,

    // ── Semantic shortcuts───────
    warning:              palette.warning,
    warningContainer:     palette.warningLight,
    info:                 palette.info,
    infoContainer:        palette.infoLight,
    success:              palette.success,
    successContainer:     palette.successLight,
  },

  dark: {
    // ── Primary
    // Lime pops brilliantly on near-black; keep it as the primary CTA.
    primary:              palette.lime500,        // #CDDC39 on #121212 — high contrast
    onPrimary:            palette.grey900,
    primaryContainer:     palette.lime900,        // muted deep olive container
    onPrimaryContainer:   palette.lime200,

    // ── Secondary 
    secondary:            palette.lime700,
    onSecondary:          palette.grey950,
    secondaryContainer:   palette.lime800,
    onSecondaryContainer: palette.lime100,

    // ── Accent─
    tertiary:             palette.yellow,
    onTertiary:           palette.grey900,
    tertiaryContainer:    '#3D3000',              // dark amber container
    onTertiaryContainer:  palette.yellow,

    // ── Error ─
    error:                '#EF9A9A',
    onError:              '#B71C1C',
    errorContainer:       '#B71C1C',
    onErrorContainer:     palette.errorLight,

    // ── Surfaces & Backgrounds
    background:           palette.grey950,        // #121212
    onBackground:         palette.lime100,        // #F0F4C3 — warm tinted text
    surface:              palette.cardDark,       // #2A2A2A
    onSurface:            palette.grey200,        // #EEEEEE
    surfaceVariant:       '#1E1E1E',
    onSurfaceVariant:     palette.grey400,        // #BDBDBD muted text
    surfaceDisabled:      palette.grey700,
    surfaceInverse:       palette.grey200,        // light element on dark bg

    // ── Borders
    outline:              palette.lime500,        // #CDDC39 — vibrant border on dark
    outlineVariant:       palette.grey600,        // #757575

    // ── Inverse
    inverseSurface:       palette.lime100,
    inverseOnSurface:     palette.grey900,
    inversePrimary:       palette.lime700,

    // ── Utility
    shadow:               'rgba(0,0,0,0.2)',
    scrim:                palette.black,
    white:                palette.white,

    // ── Semantic shortcuts
    warning:              palette.warning,
    warningContainer:     '#4A3800',
    info:                 palette.infoLight,
    infoContainer:        '#0D47A1',
    success:              palette.lime300,
    successContainer:     palette.lime900,
  },
};

export default Colors;
