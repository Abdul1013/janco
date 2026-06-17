/**
 * HomeScreen — Sprint 3 rebuild.
 *
 * Service category grid from constants/services.js.
 * Uses AppCard, AppText, theme tokens. Zero hardcoded colors.
 * Welcome header from authStore.profile.
 *
 * @module screens/HomeScreen
 */

import React from 'react';
import { View, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../constants/theme/ThemeContext';
import { useAuth } from '../hooks/authContext';
import { SERVICE_TYPES } from '../constants/services';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppCard from '../components/ui/AppCard';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';

const IconMap = { MaterialIcons, MaterialCommunityIcons };

export default function HomeScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh delay — bookings load via bookingStore on mount
    setTimeout(() => setRefreshing(false), 800);
  };

  const renderIcon = (svc) => {
    const Comp = IconMap[svc.iconFamily] || MaterialIcons;
    return <Comp name={svc.icon} size={32} color={colors.primary} />;
  };

  return (
    <ScreenWrapper
      scrollable
      style={{ paddingTop: spacing.md }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
        <AppText variant="headlineSmall" style={{ color: colors.onBackground }}>
          Welcome, {profile?.user_name || profile?.full_name || 'User'}
        </AppText>
        <MaterialIcons
          name="notifications-none"
          size={26}
          color={colors.onSurfaceVariant}
          onPress={() => {}}
        />
      </View>
      {profile?.address ? (
        <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.lg }}>
          {profile.address}
        </AppText>
      ) : null}

      {/* Section title */}
      <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.md, textAlign: 'center' }}>
        What Chore?
      </AppText>

      {/* Service grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        {SERVICE_TYPES.map((svc) => (
          <AppCard
            key={svc.id}
            elevation={1}
            onPress={
              svc.available
                ? () => navigation.navigate('Clean', { serviceType: svc.id })
                : undefined
            }
            style={{
              width: '48%',
              alignItems: 'center',
              justifyContent: 'center',
              height: 120,
              marginBottom: spacing.sm,
              opacity: svc.available ? 1 : 0.5,
            }}
          >
            {renderIcon(svc)}
            <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginTop: spacing.xs, fontWeight: '600', textAlign: 'center' }}>
              {svc.shortLabel}
            </AppText>
            {!svc.available ? (
              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, fontStyle: 'italic' }}>
                Coming soon
              </AppText>
            ) : null}
          </AppCard>
        ))}
      </View>

      {/* Next booking card */}
      {/* <AppCard elevation={2} style={{ alignItems: 'center', marginBottom: spacing.lg, paddingVertical: spacing.lg }}>
        <AppText variant="titleSmall" style={{ color: colors.onSurface, marginBottom: spacing.xs }}>
          Your next booking
        </AppText>
        <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md }}>
          No upcoming bookings
        </AppText>
        <AppButton
          title="Book A Service"
          variant="filled"
          onPress={() => navigation.navigate('Clean')}
        />
      </AppCard> */}

      {/* Quick actions */}
      <View 
      style={{  marginBottom: spacing.lg }}>
       
        <AppCard elevation={2} onPress={() => navigation.navigate('Bookings')} style={{ width: '100%', height: 120, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md }}>
          <MaterialIcons name="receipt-long" size={28} color={colors.primary} />
          <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginTop: spacing.xs, fontWeight: '600' }}>
            Bookings
          </AppText>
        </AppCard>
      </View>
    </ScreenWrapper>
  );
}
