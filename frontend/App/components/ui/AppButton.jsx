/**
 * AppButton — Material Design 3 button with Apple HIG touch targets.
 *
 * Three variants: filled (primary CTA), outlined, and text.
 * All variants enforce a minimum 48dp touch target per Apple HIG and MD3.
 *
 * @param {Object} props
 * @param {string}   props.title               - Button label
 * @param {() => void} props.onPress           - Tap handler
 * @param {'filled'|'outlined'|'text'} [props.variant='filled'] - Visual style
 * @param {boolean}  [props.loading=false]     - Show spinner, disable press
 * @param {boolean}  [props.disabled=false]    - Grey out, disable press
 * @param {import('react-native').ViewStyle} [props.style] - Extra container style
 * @returns {React.ReactElement}
 *
 * @example
 *   <AppButton title="Book Now" onPress={handleBook} />
 *   <AppButton title="Cancel" variant="outlined" onPress={handleCancel} />
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../constants/theme/ThemeContext';
import { Spacing } from '../../constants/theme';

export default function AppButton({
  title,
  onPress,
  variant = 'filled',
  loading = false,
  disabled = false,
  style,
}) {
  const { colors, typography } = useTheme();
  const isDisabled = disabled || loading;

  const containerStyles = [
    styles.base,
    variant === 'filled' && {
      backgroundColor: isDisabled ? colors.surfaceDisabled : colors.primary,
    },
    variant === 'outlined' && {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: isDisabled ? colors.outline : colors.primary,
    },
    variant === 'text' && { backgroundColor: 'transparent' },
    style,
  ];

  const labelColor =
    variant === 'filled'
      ? isDisabled
        ? colors.onSurfaceVariant
        : colors.onPrimary
      : isDisabled
        ? colors.onSurfaceVariant
        : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        ...containerStyles,
        pressed && !isDisabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <Text style={[typography.labelLarge, { color: labelColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Spacing.touchTarget,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
