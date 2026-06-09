/**
 * SplashScreen — Sprint 3 rebuild.
 *
 * Theme-aware loading screen. Shown while authStore is initializing.
 * No navigation needed — RootNavigator handles stack switching.
 *
 * @module screens/SplashScreen
 */

import React from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useTheme } from '../constants/theme/ThemeContext';
import AppText from '../components/ui/AppText';

export default function SplashScreen() {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <Image
        resizeMode="contain"
        style={{ height: 100, width: 100, marginBottom: spacing.lg }}
        source={require('../../assets/logo.png')}
      />
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
