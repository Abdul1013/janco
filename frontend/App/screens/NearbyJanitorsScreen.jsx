/**
 * NearbyJanitorsScreen — Sprint 3 rebuild.
 *
 * Calls janitorApi.getNearbyJanitors(lat, lng, serviceType).
 * FlatList with janitor cards: name, trust badge, rating, distance.
 * Skeleton loading state + EmptyState if none available.
 * Select janitor → create booking via bookingApi → navigate to JobStatus.
 *
 * @module screens/NearbyJanitorsScreen
 */

import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../constants/theme/ThemeContext';
import * as janitorApi from '../api/janitorApi';
import * as bookingApi from '../api/bookingApi';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppCard from '../components/ui/AppCard';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

export default function NearbyJanitors() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, spacing } = useTheme();

  const {
    category, rooms, toilets, clothesCount, extras,
    date, time, notes, address, userLocation,
    priceEstimate, breakdown, scanResult, useScan, areaM2,
  } = route.params || {};

  const TRANSPORT_THRESHOLD_KM = 5;
  const TRANSPORT_BAND_KM = 5;
  const TRANSPORT_BAND_FEE = 1000;

  function calcTransportFee(distanceKm) {
    if (!distanceKm || distanceKm <= TRANSPORT_THRESHOLD_KM) return 0;
    const bands = Math.floor((distanceKm - TRANSPORT_THRESHOLD_KM) / TRANSPORT_BAND_KM) + 1;
    return bands * TRANSPORT_BAND_FEE;
  }

  const [loading, setLoading] = useState(true);
  const [janitors, setJanitors] = useState([]);
  const [error, setError] = useState(null);
  const [bookingId, setBookingId] = useState(null);

  const loadJanitors = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiErr } = await janitorApi.getNearbyJanitors(
      userLocation?.lat || 0, userLocation?.lng || 0, category,
    );
    if (apiErr) {
      setError(apiErr);
    } else {
      setJanitors(data?.janitors || data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadJanitors(); }, []);

  const handleSelect = (janitor) => {
    const dist = janitor.distance_km != null ? Number(janitor.distance_km) : null;
    const fee = calcTransportFee(dist);
    const baseEstimate = priceEstimate || 0;
    const totalWithTransport = baseEstimate + fee;

    let msg = `Select ${janitor.full_name || 'this janitor'}`;
    if (dist != null) msg += ` (${dist.toFixed(1)} km away)`;
    msg += '?';
    if (fee > 0) {
      msg += `\n\nA transport fee of ₦${fee.toLocaleString()} applies. Estimated total: ₦${totalWithTransport.toLocaleString()}.`;
    } else if (baseEstimate > 0) {
      msg += `\n\nEstimated total: ₦${baseEstimate.toLocaleString()} (no transport fee).`;
    }

    Alert.alert(
      'Confirm Selection',
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => createBooking(janitor) },
      ],
    );
  };

  const createBooking = async (janitor) => {
    const payload = {
      service_type: category,
      rooms: rooms || 0,
      toilets: toilets || 0,
      clothes_count: clothesCount || 0,
      extras: extras || {},
      scheduled_date: date,
      scheduled_time: time,
      address: address || '',
      latitude: userLocation?.lat || 0,
      longitude: userLocation?.lng || 0,
      janitor_id: janitor.janitor_id ?? janitor.id,
      notes: notes || '',
      distance_km: janitor.distance_km ?? null,
      use_scan: useScan || false,
      area_m2: areaM2 ?? null,
    };

    const { data, error: apiErr } = await bookingApi.createBooking(payload);
    if (apiErr) {
      Alert.alert('Booking Failed', apiErr);
      return;
    }

    const job = data?.job || data;
    Alert.alert('Success', 'Booking created!', [
      { text: 'OK', onPress: () => navigation.navigate('JobStatus', { job }) },
    ]);
  };

  const renderJanitor = ({ item }) => (
    <AppCard elevation={1} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          source={{ uri: item.avatar_url || undefined }}
          style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surfaceVariant }}
        />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '700' }}>
            {item.full_name || 'Unnamed Janitor'}
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: 2 }}>
            {item.bio || 'Available janitor'}
          </AppText>
          <View style={{ flexDirection: 'row', marginTop: spacing.xs, gap: spacing.md }}>
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {item.distance_km != null ? `${Number(item.distance_km).toFixed(1)} km` : '—'}
            </AppText>
            {item.avg_rating ? (
              <AppText variant="bodySmall" style={{ color: colors.warning ?? '#F59E0B' }}>
                {Number(item.avg_rating).toFixed(1)}★
              </AppText>
            ) : null}
            {item.trust_tier ? (
              <View style={{ backgroundColor: colors.primaryContainer, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                <AppText variant="bodySmall" style={{ color: colors.onPrimaryContainer, fontWeight: '600' }}>
                  {item.trust_tier}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <AppButton title="Select" onPress={() => handleSelect(item)} style={{ minWidth: 80 }} />
      </View>
    </AppCard>
  );

  return (
    <ScreenWrapper title="Choose a Janitor" showBack scrollable={false}>
    
      <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md, textAlign: 'center' }}>
        Select someone nearby to handle your booking
      </AppText>

      {loading ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </View>
      ) : error ? (
        <EmptyState
          icon="error-outline"
          title="Could not load janitors"
          subtitle={error}
          actionLabel="Retry"
          onAction={loadJanitors}
        />
      ) : (
        <FlatList
          data={janitors}
          keyExtractor={(item) => item.janitor_id ?? item.id ?? String(Math.random())}
          renderItem={renderJanitor}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          ListEmptyComponent={
            <EmptyState
              icon="person-search"
              title="No janitors found"
              subtitle="No available janitors in your area right now."
              actionLabel="Retry"
              onAction={loadJanitors}
            />
          }
        />
      )}
    </ScreenWrapper>
  );
}
