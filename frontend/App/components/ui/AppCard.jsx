/**
 * AppCard — MD3 elevated card with optional press handler.
 *
 * Props:
 *   - children: React.ReactNode
 *   - elevation?: 0 | 1 | 2 | 3 | 4 | 5 (default 1)
 *   - onPress?: () => void  — makes card tappable (48dp min touch target)
 *   - style?: ViewStyle      — merged into container
 *
 * @module components/ui/AppCard
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../constants/theme/ThemeContext';

export default function AppCard({ children, elevation = 1, onPress, style }) {
  const { colors, elevation: elevationMap, spacing } = useTheme();

  const elevStyle = elevationMap[`level${elevation}`] ?? {};

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderRadius: spacing.md,
      padding: spacing.md,
    },
    elevStyle,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
          styles.touchTarget,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  touchTarget: {
    minHeight: 48,
    minWidth: 48,
  },
});
