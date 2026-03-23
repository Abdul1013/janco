/**
 * RegistrationScreen — Sprint 3 rebuild.
 *
 * Post-signup profile completion. Uses authStore.updateProfile()
 * to upsert profile fields via the backend API.
 * Zero direct Supabase calls. All styles from useTheme().
 *
 * @module screens/auth/RegistrationScreen
 */

import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../constants/theme/ThemeContext';
import { useAuth } from '../../hooks/authContext';
import useAuthStore from '../../store/authStore';
import useUserLocation from '../../hooks/useUserLocation';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppText from '../../components/ui/AppText';

export default function RegistrationScreen() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { address, coords, errorMsg: locationError } = useUserLocation();

  const [userName, setUserName] = useState('');
  const [phone, setPhone] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (address) setUserAddress(address);
  }, [address]);

  const validate = () => {
    const e = {};
    if (!userName.trim()) e.userName = 'Username is required.';
    if (!phone.trim()) e.phone = 'Phone number is required.';
    if (!userAddress.trim()) e.userAddress = 'Address is required.';
    if (!landmark.trim()) e.landmark = 'Landmark is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegistration = async () => {
    if (!validate()) return;
    setLoading(true);

    const result = await updateProfile({
      user_name: userName.trim(),
      phone: phone.trim(),
      address: userAddress.trim(),
      landmark: landmark.trim(),
      lat: coords?.lat ?? 0,
      lng: coords?.lng ?? 0,
      is_registered: true,
    });

    setLoading(false);

    if (result?.error) {
      setErrors({ api: result.error });
    }
    // On success, authStore updates profile.is_registered → RootNavigator
    // automatically navigates to MainStack.
  };

  return (
    <ScreenWrapper avoidKeyboard>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.md }}>
        <AppText variant="headlineMedium" style={{ marginBottom: spacing.lg, color: colors.onBackground }}>
          Complete Your Registration
        </AppText>

        <AppInput
          label="Username"
          value={userName}
          onChangeText={setUserName}
          error={errors.userName}
          inputProps={{ autoCapitalize: 'none', placeholder: 'Choose a username' }}
        />
        <AppInput
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          inputProps={{ keyboardType: 'phone-pad', placeholder: 'Your phone number' }}
        />
        <AppInput
          label="Address"
          value={userAddress}
          onChangeText={setUserAddress}
          error={errors.userAddress}
          inputProps={{ placeholder: 'Your address' }}
        />
        <AppInput
          label="Nearest Landmark"
          value={landmark}
          onChangeText={setLandmark}
          error={errors.landmark}
          inputProps={{ placeholder: 'e.g. Unity Bank, Tanke' }}
        />

        {locationError ? (
          <AppText variant="bodySmall" style={{ color: colors.error, marginBottom: spacing.sm }}>
            {locationError}
          </AppText>
        ) : null}

        {errors.api ? (
          <AppText variant="bodySmall" style={{ color: colors.error, marginBottom: spacing.sm }}>
            {errors.api}
          </AppText>
        ) : null}

        <AppButton title="Submit" onPress={handleRegistration} loading={loading} />
      </View>
    </ScreenWrapper>
  );
}
