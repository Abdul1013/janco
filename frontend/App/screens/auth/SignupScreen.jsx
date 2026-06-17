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
import { View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Name is required.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (!acceptedTerms) e.terms = 'You must accept the Terms & Privacy Policy.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    const result = await signup(email.trim(), password, fullName.trim(), acceptedTerms);
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

        {/* Terms & Privacy consent */}
        <Pressable
          onPress={() => setAcceptedTerms((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.xs, marginBottom: spacing.xs }}
          hitSlop={6}
        >
          <MaterialIcons
            name={acceptedTerms ? 'check-box' : 'check-box-outline-blank'}
            size={22}
            color={acceptedTerms ? colors.primary : colors.onSurfaceVariant}
            style={{ marginRight: spacing.xs, marginTop: 1 }}
          />
          <AppText variant="bodySmall" style={{ flex: 1, color: colors.onSurfaceVariant }}>
            I agree to the{' '}
            <AppText
              variant="bodySmall"
              style={{ color: colors.primary, fontWeight: '600' }}
              onPress={() => navigation.navigate('Legal', { docType: 'terms' })}
            >
              Terms &amp; Conditions
            </AppText>
            {' '}and{' '}
            <AppText
              variant="bodySmall"
              style={{ color: colors.primary, fontWeight: '600' }}
              onPress={() => navigation.navigate('Legal', { docType: 'privacy' })}
            >
              Privacy Policy
            </AppText>
            .
          </AppText>
        </Pressable>
        {errors.terms ? (
          <AppText variant="bodySmall" style={{ color: colors.error, marginBottom: spacing.sm }}>
            {errors.terms}
          </AppText>
        ) : null}

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
