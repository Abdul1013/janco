/**
 * ProfileScreen — Sprint 3 rebuild.
 *
 * Displays user info from authStore.profile.
 * Editable fields: name, phone.
 * Dark mode toggle via useTheme().toggleTheme.
 * Logout button.
 *
 * @module screens/ProfileScreen
 */

import React, { useState } from 'react';
import { View, Switch, Image, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../constants/theme/ThemeContext';
import { useAuth } from '../hooks/authContext';
import useAuthStore from '../store/authStore';
import useUserLocation from '../hooks/useUserLocation';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppCard from '../components/ui/AppCard';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';

export default function ProfileScreen({ navigation }) {
  const { colors, spacing, isDark, toggleTheme } = useTheme();
  const { profile, logout, updateProfile, loading } = useAuthStore();
  const { setViewAsCustomer } = useAuth();
  const { address: gpsAddress, coords, errorMsg: locationError } = useUserLocation(profile);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name || profile?.user_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingLocation, setSavingLocation] = useState(false);

  const handleSave = async () => {
    await updateProfile({ full_name: name, phone });
    setEditing(false);
  };

  const handleSaveLocation = async () => {
    if (!coords?.lat || !coords?.lng) {
      Alert.alert('Location Unavailable', 'Could not detect your location. Please ensure location services are enabled.');
      return;
    }
    setSavingLocation(true);
    await updateProfile({
      lat: coords.lat,
      lng: coords.lng,
      address: gpsAddress || profile?.address || '',
    });
    setSavingLocation(false);
    Alert.alert('Location Saved', 'Your location has been updated for faster booking.');
  };

  const avatarUri = profile?.avatar_url || null;

  return (
    <ScreenWrapper>
      {/* Avatar + Name */}
      <View style={{ alignItems: 'center', marginBottom: spacing.lg, marginTop: spacing.md }}>
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: 88, height: 88, borderRadius: 44, marginBottom: spacing.sm }}
          />
        ) : (
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: colors.primaryContainer,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.sm,
            }}
          >
            <MaterialIcons name="person" size={48} color={colors.onPrimaryContainer} />
          </View>
        )}
        <AppText variant="titleLarge" style={{ color: colors.onBackground }}>
          {profile?.full_name || profile?.user_name || 'User'}
        </AppText>
        <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {profile?.email || ''}
        </AppText>
      </View>

      {/* Edit Profile */}
      {editing ? (
        <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
          <AppInput label="Full Name" value={name} onChangeText={setName} />
          <AppInput label="Phone" value={phone} onChangeText={setPhone} inputProps={{ keyboardType: 'phone-pad' }} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <AppButton title="Save" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
            <AppButton title="Cancel" variant="outlined" onPress={() => setEditing(false)} style={{ flex: 1 }} />
          </View>
        </AppCard>
      ) : (
        <AppCard elevation={1} onPress={() => setEditing(true)} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>Edit Profile</AppText>
            <MaterialIcons name="edit" size={20} color={colors.onSurfaceVariant} />
          </View>
        </AppCard>
      )}

      {/* Location */}
      <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <MaterialIcons name="location-on" size={22} color={colors.primary} />
          <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>My Location</AppText>
        </View>
        {profile?.address ? (
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>
            Saved: {profile.address}
          </AppText>
        ) : null}
        {coords?.lat ? (
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.sm }}>
            GPS: {gpsAddress || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}
          </AppText>
        ) : locationError ? (
          <AppText variant="bodySmall" style={{ color: colors.error, marginBottom: spacing.sm }}>
            Location unavailable — enable location services for better janitor matching.
          </AppText>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: spacing.sm }} />
        )}
        <AppButton
          title={savingLocation ? 'Saving...' : 'Update My Location'}
          variant="outlined"
          onPress={handleSaveLocation}
          disabled={!coords?.lat || savingLocation}
          loading={savingLocation}
        />
      </AppCard>

      {/* ── Role-aware Menu Items  */}
      {profile?.role === 'janitor' ? (
        <>
          {/* Janitor-specific actions */}
          <AppCard elevation={1} onPress={() => { setViewAsCustomer(true); navigation.navigate('MainTabs', { screen: 'HomeScreen' }); }} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialIcons name="swap-horiz" size={22} color={colors.primary} />
              <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>View Customer Dashboard</AppText>
            </View>
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
              Switch to booking view
            </AppText>
          </AppCard>

          <AppCard elevation={1} onPress={() => navigation.navigate('JanitorDashBoard')} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialIcons name="dashboard" size={22} color={colors.primary} />
              <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>Janitor Dashboard</AppText>
            </View>
          </AppCard>

          <AppCard elevation={1} onPress={() => navigation.navigate('Verification')} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialIcons name="verified-user" size={22} color={colors.primary} />
              <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>ID Verification</AppText>
            </View>
          </AppCard>

          <AppCard elevation={1} onPress={() => navigation.navigate('JanitorStatus')} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialIcons name="info-outline" size={22} color={colors.primary} />
              <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>Application Status</AppText>
            </View>
          </AppCard>
        </>
      ) : (
        <>
          {/* Customer actions */}
          <AppCard elevation={1} onPress={() => navigation.navigate('JanitorRegistration')} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialIcons name="cleaning-services" size={22} color={colors.primary} />
              <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>Become a Janitor</AppText>
            </View>
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
              Apply to earn on the JANCO platform
            </AppText>
          </AppCard>
        </>
      )}

      <AppCard elevation={1} onPress={() => {}} style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <MaterialIcons name="help-outline" size={22} color={colors.primary} />
          <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>Help / Support</AppText>
        </View>
      </AppCard>

      {/* Dark Mode Toggle */}
      <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={22} color={colors.primary} />
            <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>Dark Mode</AppText>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.outline, true: colors.primaryContainer }}
            thumbColor={isDark ? colors.primary : colors.onSurfaceVariant}
          />
        </View>
      </AppCard>

      {/* Logout */}
      <AppButton
        title="Logout"
        variant="outlined"
        onPress={logout}
        style={{ borderColor: colors.error, marginBottom: spacing.md }}
      />

      {/* Version */}
      <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
        JANCO v1.0.0 beta
      </AppText>
    </ScreenWrapper>
  );
}
