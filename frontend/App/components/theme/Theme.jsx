// theme/typography.js
// npm install react-native-size-matters

import { StyleSheet } from "react-native";
import { normalizeFont, normalizeSpace } from "./normalize";
import Checkbox from "expo-checkbox";

// const { isDarkmode, setTheme } = useTheme();
export const Colors = {
  light: {
    primary: "#CDDC39",
    secondary: "#AFB42B",
    accent: "#FFEB3B",
    background: "#F0F4C3",
    text: "#212121",
    textMuted: "#757575",
    border: "#BDBDBD",
    white: "#FFFFFF",
    cardBackground: "#F7F8F2",
    cardBackground2: "#2A2A2A",
    //
    cardBorder: "#AFB42B",
    shadow: "rgba(0,0,0,0.08)",
  },
  dark: {
    primary: "#CDDC39",
    secondary: "#AFB42B",
    accent: "#FFEB3B",
    background: "#121212",
    text: "#F0F4C3",
    textMuted: "#BDBDBD",
    border: "#757575",
    white: "#FFFFFF",
    cardBackground: "#2A2A2A",
    cardBackground2: "#eee",

    cardBorder: "#CDDC39",
    shadow: "rgba(0,0,0,0.2)",
  },
};

export const fonts = {
  title: "Chewy",
  default: "Quicksand",
  medium: "QuicksandMedium",
  bold: "QuicksandBold",
};

export const fontSizes = {
  h1: normalizeFont(32),
  h2: normalizeFont(24),
  h3: normalizeFont(20),
  body: normalizeFont(16),
  small: normalizeFont(14),
  caption: normalizeFont(12),
};

export const Spacing = {
  xxs: normalizeSpace(4),
  xs: normalizeSpace(8),
  sm: normalizeSpace(12),
  md: normalizeSpace(16),
  lg: normalizeSpace(24),
  xl: normalizeSpace(32),
  xxl: normalizeSpace(40),
};

export const Border = {
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 16,
};

export const Elevation = {
  card: 3,
  modal: 10,
  dropdown: 5,
};

export const Typography = StyleSheet.create({
  container: {
    flex: 1,
    //  backgroundColor: isDarkmode ? "#17171E" : themeColor.white100,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  default: {
    fontSize: fontSizes.body,
    lineHeight: normalizeFont(24),
    fontFamily: fonts.default,
    color: Colors.light.text,
  },
  defaultSemiBold: {
    fontSize: fontSizes.body,
    lineHeight: normalizeFont(24),
    fontFamily: fonts.medium,
    color: Colors.light.text,
  },
  title: {
    fontSize: fontSizes.h1,
    lineHeight: normalizeFont(36),
    fontFamily: fonts.title,
    color: Colors.dark.accent,
  },
  subtitle: {
    fontSize: fontSizes.h3,
    lineHeight: normalizeFont(28),
    fontFamily: fonts.bold,
    color: Colors.dark.textMuted,
  },
  link: {
    fontSize: fontSizes.body,
    lineHeight: normalizeFont(30),
    fontFamily: fonts.default,
    color: Colors.light.accent,
  },
  note: {
    fontSize: 14,
    lineHeight: normalizeSpace(12),
    color: "#777",
    textAlign: "center",
  },
  header: {
    fontSize: 16,
    color: "#BBB",
    textAlign: "center",
  },
  buttonText: {
    fontSize: fontSizes.body,
    // fontFamily: fonts.bold,
    color: Colors.dark.textMuted,
    textAlign: "center",
    // textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
    color:Colors.dark.cardBackground2
  },
  checkBox: { flexDirection: "row", justifyContent: 'space-between', marginBottom: Spacing.sm},
  uploadBox: {
    borderWidth: 2,
    borderColor: "#444",
    borderRadius: 12,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    marginBottom: 20,
  },
  uploadText: {
    marginTop: 10,
    color: "#888",
  },
  scanList: {
    maxHeight: 220,
  },
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
    justifyContent: "space-between",
  },
  scanImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  scanText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFF",
  },
});
// color="#007bff"
