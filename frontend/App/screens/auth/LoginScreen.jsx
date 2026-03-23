/**
 * LoginScreen — Sprint 3 rebuild.
 *
 * @module screens/auth/LoginScreen
 */

import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../constants/theme/ThemeContext';
import useAuthStore from '../../store/authStore';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppText from '../../components/ui/AppText';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <ScreenWrapper avoidKeyboard scrollable={false}>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.md }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Image
            resizeMode="contain"
            style={{ height: 100, width: 100 }}
            source={require('../../../assets/logo.png')}
          />
        </View>

        {/* Title */}
        <AppText variant="headlineMedium" style={{ marginBottom: spacing.lg, color: colors.onBackground }}>
          Login to Get Started
        </AppText>

        {/* Inputs */}
        <AppInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          inputProps={{
            autoCapitalize: 'none',
            keyboardType: 'email-address',
            autoCorrect: false,
            placeholder: 'Enter your email',
          }}
        />
        <AppInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          inputProps={{
            autoCapitalize: 'none',
            placeholder: 'Enter your password',
          }}
        />

        {/* Error */}
        {error ? (
          <AppText variant="bodySmall" style={{ color: colors.error, marginBottom: spacing.sm }}>
            {error}
          </AppText>
        ) : null}

        {/* Login button */}
        <AppButton title="Login" onPress={handleLogin} loading={loading} />

        {/* Links */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md }}>
          <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            Don't have an account?{' '}
          </AppText>
          <AppText
            variant="bodyMedium"
            style={{ color: colors.primary, fontWeight: '600' }}
            onPress={() => navigation.navigate('Signup')}
          >
            Register here
          </AppText>
        </View>

        <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
          <AppText
            variant="bodySmall"
            style={{ color: colors.onSurfaceVariant }}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            Forgot password?
          </AppText>
        </View>
      </View>
    </ScreenWrapper>
  );
}
