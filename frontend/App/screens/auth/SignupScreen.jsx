/**
 * SignupScreen — Sprint 3 rebuild.
 *
 * Uses ScreenWrapper, AppInput, AppButton, AppText.
 * Input validation: email format, password min 8 chars, name required.
 * Calls authStore.signup() on submit.
 *
 * @module screens/auth/SignupScreen
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../constants/theme/ThemeContext';
import useAuthStore from '../../store/authStore';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppText from '../../components/ui/AppText';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const signup = useAuthStore((s) => s.signup);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Name is required.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    const result = await signup(email.trim(), password, fullName.trim());
    setLoading(false);
    if (result?.error) {
      setErrors({ api: result.error });
    }
  };

  return (
    <ScreenWrapper avoidKeyboard>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.md }}>
        <AppText variant="headlineMedium" style={{ marginBottom: spacing.lg, color: colors.onBackground }}>
          Create Account
        </AppText>

        <AppInput
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          inputProps={{ autoCapitalize: 'words', placeholder: 'Your full name' }}
        />
        <AppInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          inputProps={{ autoCapitalize: 'none', keyboardType: 'email-address', placeholder: 'Your email' }}
        />
        <AppInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={errors.password}
          inputProps={{ placeholder: 'Min 8 characters' }}
        />
        <AppInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={errors.confirmPassword}
          inputProps={{ placeholder: 'Re-enter password' }}
        />

        {errors.api ? (
          <AppText variant="bodySmall" style={{ color: colors.error, marginBottom: spacing.sm }}>
            {errors.api}
          </AppText>
        ) : null}

        <AppButton title="Create Account" onPress={handleSignup} loading={loading} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md }}>
          <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            Already have an account?{' '}
          </AppText>
          <AppText
            variant="bodyMedium"
            style={{ color: colors.primary, fontWeight: '600' }}
            onPress={() => navigation.navigate('Login')}
          >
            Login here
          </AppText>
        </View>
      </View>
    </ScreenWrapper>
  );
}
