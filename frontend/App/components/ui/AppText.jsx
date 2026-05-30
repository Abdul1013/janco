/**
 * AppText — Theme-aware text component.
 *
 * Wraps React Native <Text> and applies the correct TypeScale variant
 * and theme colour automatically.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {keyof import('../../constants/theme/typography').TypeScale} [props.variant='bodyMedium']
 * @param {string}  [props.color]   - Override colour (defaults to onSurface)
 * @param {'left'|'center'|'right'} [props.align='left']
 * @param {import('react-native').TextStyle} [props.style] - Extra style
 * @returns {React.ReactElement}
 *
 * @example
 *   <AppText variant="headlineMedium">Welcome</AppText>
 *   <AppText variant="bodySmall" color={colors.error}>Error!</AppText>
 */

import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../constants/theme/ThemeContext';

export default function AppText({
  children,
  variant = 'bodyMedium',
  color,
  align = 'left',
  style,
  ...rest
}) {
  const { colors, typography } = useTheme();

  return (
    <Text
      style={[
        typography[variant],
        { color: color ?? colors.onSurface, textAlign: align },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
