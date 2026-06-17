/**
 * AuthCallbackScreen — Sprint 3 rebuild.
 *
 * Handles deep-link callback from Supabase (password recovery, email verify).
 * Restores session via authStore — zero direct Supabase calls.
 * All styles from useTheme().
 *
 * @module screens/AuthCallbackScreen
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../constants/theme/ThemeContext';
import useAuthStore from '../store/authStore';
import AppText from '../components/ui/AppText';

export default function AuthCallbackScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const initialize = useAuthStore((s) => s.initialize);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleDeepLink = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) {
          setError('No callback URL received.');
          return;
        }

        const fragment = url.split('#')[1];
        if (!fragment) {
          setError('Invalid callback URL.');
          return;
        }

        const params = new URLSearchParams(fragment);
        const type = params.get('type');

        // Re-initialize authStore — it will pick up the new session
        // from AsyncStorage if the Supabase client has already set it.
        await initialize();

        if (type === 'recovery') {
          navigation.replace('UpdatePassword');
        } else {
          navigation.replace('Login');
        }
      } catch (err) {
        setError('Failed to restore session.');
      }
    };

    handleDeepLink();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: spacing.md,
      }}
    >
      {error ? (
        <AppText variant="bodyMedium" style={{ color: colors.error, textAlign: 'center' }}>
          {error}
        </AppText>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText
            variant="bodyMedium"
            style={{ marginTop: spacing.md, color: colors.onSurfaceVariant }}
          >
            Restoring session...
          </AppText>
        </>
      )}
    </View>
  );
}
