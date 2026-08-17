/**
 * JanitorStatusScreen — Sprint 3 rebuild.
 *
 * Shows application status after janitor registration.
 * Uses janitorApi to check approval status — zero direct Supabase calls.
 * All styles from useTheme().
 *
 * @module screens/Janitor/JanitorStatusScreen
 */

import React, { useState } from 'react';
import { View, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../constants/theme/ThemeContext';
import { useAuth } from '../../hooks/authContext';
import * as janitorApi from '../../../api/janitorApi';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppText from '../../components/ui/AppText';
import AppButton from '../../components/ui/AppButton';

export default function JanitorStatusScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const [checking, setChecking] = useState(false);

  const checkApprovalStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await janitorApi.getJanitorProfile(user?.id);

      if (error) {
        Alert.alert('Error', 'Could not check status.');
        setChecking(false);
        return;
      }

      if (data?.status === 'approved') {
        Alert.alert("You're now a Janitor!", 'Redirecting to your dashboard...');
        navigation.replace('JanitorDashboard');
      } else {
        Alert.alert('Review still in progress', 'Please check back later.');
      }
    } catch {
      Alert.alert('Error', 'Could not check status.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScreenWrapper>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.md,
        }}
      >
        <AppText variant="headlineSmall" style={{ color: colors.onBackground, marginBottom: spacing.md }}>
          Application Received!
        </AppText>

        <Image
          source={require('../../../assets/approval.png')}
          style={{
            width: 180,
            height: 180,
            marginVertical: spacing.lg,
            borderRadius: 90,
          }}
          resizeMode="contain"
        />

        <AppText
          variant="bodyMedium"
          style={{
            color: colors.onSurfaceVariant,
            textAlign: 'center',
            marginBottom: spacing.lg,
            paddingHorizontal: spacing.md,
          }}
        >
          Your request to become a janitor is being reviewed. You will be notified once approved.
        </AppText>

        <AppButton
          title="Check Now"
          onPress={checkApprovalStatus}
          loading={checking}
          style={{ marginBottom: spacing.sm, width: '100%' }}
        />
        <AppButton
          title="Back to Home"
          variant="outlined"
          onPress={() => navigation.navigate('MainTabs')}
          style={{ width: '100%' }}
        />
      </View>
    </ScreenWrapper>
  );
}
