/**
 * AppInput — MD3 outlined text field.
 *
 * Includes floating label effect, error/helper text, and optional
 * left/right icons.  Touch target is always >= 48dp.
 *
 * @param {Object} props
 * @param {string}   props.label       - Field label (doubles as placeholder)
 * @param {string}   [props.value]     - Controlled value
 * @param {(text: string) => void} [props.onChangeText]
 * @param {string}   [props.error]     - Error message (turns border red)
 * @param {string}   [props.helper]    - Helper text below input
 * @param {React.ReactNode} [props.leftIcon]
 * @param {React.ReactNode} [props.rightIcon]
 * @param {boolean}  [props.secureTextEntry=false]
 * @param {import('react-native').TextInputProps} [props.inputProps] - Pass-through
 * @param {import('react-native').ViewStyle} [props.style]
 * @returns {React.ReactElement}
 *
 * @example
 *   <AppInput label="Email" value={email} onChangeText={setEmail} error={emailError} />
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../constants/theme/ThemeContext';
import { Spacing } from '../../constants/theme';

export default function AppInput({
  label,
  value,
  onChangeText,
  error,
  helper,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  inputProps = {},
  style,
}) {
  const { colors, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
      ? colors.primary
      : colors.outline;

  return (
    <View style={[styles.wrapper, style]}>
      {/* Label */}
      <Text style={[typography.bodySmall, { color: error ? colors.error : colors.onSurfaceVariant, marginBottom: Spacing.xs }]}>
        {label}
      </Text>

      {/* Input row */}
      <View style={[styles.inputRow, { borderColor, backgroundColor: colors.surface }]}>
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        <TextInput
          style={[
            typography.bodyLarge,
            styles.input,
            { color: colors.onSurface },
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry}
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel={label}
          {...inputProps}
        />
        {rightIcon && <View style={styles.icon}>{rightIcon}</View>}
      </View>

      {/* Helper / Error text */}
      {(error || helper) && (
        <Text
          style={[
            typography.bodySmall,
            { color: error ? colors.error : colors.onSurfaceVariant, marginTop: Spacing.xs },
          ]}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.base },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Spacing.touchTarget,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, paddingVertical: Spacing.sm },
  icon: { marginHorizontal: Spacing.xs },
});
