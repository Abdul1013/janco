/**
 * OfflineBanner — persistent red banner when device is offline.
 *
 * Reads `isOnline` from networkStore and shows an animated
 * slide-in/out banner at the top of the screen.
 *
 * @module components/ui/OfflineBanner
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import useNetworkStore from '../../store/networkStore';
import { useTheme } from '../../constants/theme/ThemeContext';

export default function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { colors, spacing } = useTheme();
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOnline ? -60 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, translateY]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.error,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.text, { color: colors.onError }]}>
        You're offline — changes will sync when reconnected
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
