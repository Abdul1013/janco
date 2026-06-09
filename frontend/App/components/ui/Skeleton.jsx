/**
 * Skeleton — animated placeholder for loading states.
 *
 * Variants:
 *   - text    (height 14, full width)
 *   - circle  (square with borderRadius 50%)
 *   - card    (height 120, full width, rounded)
 *   - list    (3 text skeletons stacked)
 *
 * Props:
 *   - variant?: 'text' | 'circle' | 'card' | 'list' (default 'text')
 *   - width?: number | string
 *   - height?: number
 *   - style?: ViewStyle
 *
 * @module components/ui/Skeleton
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../constants/theme/ThemeContext';

export default function Skeleton({ variant = 'text', width, height, style }) {
  const { colors, spacing } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  const base = {
    backgroundColor: colors.surfaceVariant,
    borderRadius: spacing.xs,
    opacity,
  };

  if (variant === 'list') {
    return (
      <View style={[styles.listContainer, style]}>
        {[0.9, 1, 0.7].map((w, i) => (
          <Animated.View
            key={i}
            style={[base, styles.text, { width: `${w * 100}%`, marginBottom: spacing.sm }]}
          />
        ))}
      </View>
    );
  }

  const variantStyles = {
    text: { height: height ?? 14, width: width ?? '100%' },
    circle: {
      height: height ?? 48,
      width: width ?? 48,
      borderRadius: (height ?? 48) / 2,
    },
    card: {
      height: height ?? 120,
      width: width ?? '100%',
      borderRadius: spacing.md,
    },
  };

  return <Animated.View style={[base, variantStyles[variant], style]} />;
}

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
  },
  text: {
    height: 14,
  },
});
