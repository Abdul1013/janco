/**
 * UpdatePasswordScreen — Sprint 3 rebuild.
 *
 * Uses ScreenWrapper, AppInput, AppButton, AppText.
 * Calls authApi.updatePassword() — zero direct Supabase calls.
 *
 * @module screens/auth/UpdatePasswordScreen
 */

import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../constants/theme/ThemeContext';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppText from '../../components/ui/AppText';
import * as authApi from '../../../api/authApi';

export default function UpdatePasswordScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await authApi.updatePassword(password);
    setLoading(false);

    if (error) {
      setErrors({ api: error });
    } else {
      Alert.alert('Success', 'Password updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <ScreenWrapper avoidKeyboard>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.md }}>
        <AppText variant="headlineMedium" style={{ marginBottom: spacing.lg, color: colors.onBackground }}>
          Set New Password
        </AppText>

        <AppInput
          label="New Password"
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

        <AppButton title="Update Password" onPress={handleUpdate} loading={loading} />
      </View>
    </ScreenWrapper>
  );
}
