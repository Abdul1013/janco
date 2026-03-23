/**
 * ForgetPasswordScreen — Sprint 3 rebuild.
 *
 * Sends a password-reset request via authApi.requestPasswordReset().
 * Shows a success confirmation.
 *
 * @module screens/auth/ForgetPasswordScreen
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../constants/theme/ThemeContext';
import * as authApi from '../../api/authApi';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppText from '../../components/ui/AppText';

export default function ForgetPasswordScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error: apiError } = await authApi.requestPasswordReset(email.trim());
    setLoading(false);
    if (apiError) {
      setError(apiError);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <ScreenWrapper scrollable={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <AppText variant="headlineMedium" style={{ color: colors.onBackground, marginBottom: spacing.md, textAlign: 'center' }}>
            Check Your Email
          </AppText>
          <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: spacing.xl }}>
            A password reset link has been sent to {email}. Please check your inbox.
          </AppText>
          <AppButton title="Back to Login" variant="outlined" onPress={() => navigation.navigate('Login')} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper avoidKeyboard scrollable={false}>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.md }}>
        <AppText variant="headlineMedium" style={{ marginBottom: spacing.sm, color: colors.onBackground }}>
          Forgot Password
        </AppText>
        <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.lg }}>
          Enter the email associated with your account and we'll send a reset link.
        </AppText>

        <AppInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={error || undefined}
          inputProps={{ autoCapitalize: 'none', keyboardType: 'email-address', placeholder: 'Your email' }}
        />

        <AppButton title="Send Reset Link" onPress={handleReset} loading={loading} />

        <View style={{ alignItems: 'center', marginTop: spacing.md }}>
          <AppText
            variant="bodyMedium"
            style={{ color: colors.primary }}
            onPress={() => navigation.navigate('Login')}
          >
            Back to Login
          </AppText>
        </View>
      </View>
    </ScreenWrapper>
  );
}
