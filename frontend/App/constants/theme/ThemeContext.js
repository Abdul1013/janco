/**
 * JANCO ThemeProvider & useTheme Hook
 *
 * Wraps the app to provide colour-scheme-aware design tokens.
 * Reads the device preference via useColorScheme() and allows the
 * user to override it.  The override is persisted in AsyncStorage.
 *
 * Usage:
 *   // In App.jsx
 *   import { ThemeProvider } from './constants/theme/ThemeContext';
 *   <ThemeProvider>{children}</ThemeProvider>
 *
 *   // In any component
 *   import { useTheme } from '../constants/theme/ThemeContext';
 *   const { colors, typography, spacing, elevation, isDark, toggleTheme } = useTheme();
 *
 * @module theme/ThemeContext
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from './colors';
import { TypeScale } from './typography';
import { Spacing } from './spacing';
import { Elevation } from './elevation';

const STORAGE_KEY = '@janco_color_scheme';

/**
 * @typedef {Object} ThemeContextValue
 * @property {Record<string, string>} colors     - Active colour tokens
 * @property {Record<string, import('react-native').TextStyle>} typography - Type scale
 * @property {Record<string, number>} spacing     - Spacing scale
 * @property {Record<string, import('react-native').ViewStyle>} elevation - Shadow styles
 * @property {boolean} isDark                      - true when dark mode active
 * @property {() => void} toggleTheme              - Flip between light/dark
 * @property {'light'|'dark'} colorScheme          - Current scheme name
 */

/** @type {React.Context<ThemeContextValue>} */
const ThemeContext = createContext(undefined);

/**
 * Provides theme tokens to all descendants.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {React.ReactElement}
 */
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [override, setOverride] = useState(null); // null = follow system

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === 'light' || value === 'dark') setOverride(value);
    });
  }, []);

  const colorScheme = override ?? systemScheme;
  const isDark = colorScheme === 'dark';

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setOverride(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(
    () => ({
      colors: Colors[colorScheme],
      typography: TypeScale,
      spacing: Spacing,
      elevation: Elevation,
      isDark,
      toggleTheme,
      colorScheme,
    }),
    [colorScheme, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Access the current theme tokens.
 *
 * Must be called inside a <ThemeProvider>.
 *
 * @returns {ThemeContextValue}
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used inside <ThemeProvider>');
  }
  return ctx;
}
