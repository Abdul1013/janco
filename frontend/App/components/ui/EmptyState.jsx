/**
 * EmptyState — shown when a list returns zero items.
 *
 * Props:
 *   - icon?: string (MaterialIcons name, default 'inbox')
 *   - title: string
 *   - subtitle?: string
 *   - actionLabel?: string  — text on the optional action button
 *   - onAction?: () => void — handler for the optional action button
 *
 * @module components/ui/EmptyState
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import AppText from './AppText';
import AppButton from './AppButton';

export default function EmptyState({
  icon = 'inbox',
  title,
  subtitle,
  actionLabel,
  onAction,
}) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.container, { padding: spacing.xl }]}>
      <MaterialIcons
        name={icon}
        size={64}
        color={colors.onSurfaceVariant}
        style={{ marginBottom: spacing.md }}
      />

      <AppText
        variant="titleMedium"
        style={[styles.title, { color: colors.onSurface }]}
      >
        {title}
      </AppText>

      {subtitle ? (
        <AppText
          variant="bodyMedium"
          style={[styles.subtitle, { color: colors.onSurfaceVariant, marginTop: spacing.xs }]}
        >
          {subtitle}
        </AppText>
      ) : null}

      {actionLabel && onAction ? (
        <AppButton
          title={actionLabel}
          variant="filled"
          onPress={onAction}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: '600',
  },
  subtitle: {
    textAlign: 'center',
  },
});
