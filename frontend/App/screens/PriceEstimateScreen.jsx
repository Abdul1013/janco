/**
 * PriceEstimateScreen — Sprint 3 rebuild.
 *
 * Fetches estimate from backend pricing API.
 * Uses ScreenWrapper, AppCard, AppText, AppButton — zero hardcoded colors.
 *
 * @module screens/PriceEstimateScreen
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../constants/theme/ThemeContext';
import * as pricingApi from '../api/pricingApi';
import * as roomScanApi from '../api/roomScanApi';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import AppCard from '../components/ui/AppCard';

function formatPrice(amount) {
  return `\u20A6${Number(amount).toLocaleString()}`;
}

function getServiceLabel(serviceType) {
  const labels = {
    house_cleaning: 'House Cleaning',
    deep_cleaning: 'Deep Cleaning',
    laundry: 'Laundry',
    fumigation: 'Fumigation',
    post_construction: 'Post-Construction',
  };
  return labels[serviceType] || serviceType;
}

export default function PriceEstimateScreen({ route }) {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const params = route?.params || {};

  const {
    category,
    rooms = 1,
    toilets = 0,
    clothesCount = 0,
    extras = {},
    date = '',
    time = '',
    notes = '',
    address = '',
    userLocation = { lat: 0, lng: 0 },
    scanResult = null,
    distanceKm = null,
  } = params;

  const [estimate, setEstimate] = useState(null);
  const [transportFee, setTransportFee] = useState(0);
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchEstimate = async () => {
      setLoading(true);
      setError(null);

      const useScan = !!(scanResult?.estimated_area && scanResult.estimated_area > 0);
      const areaM2 = useScan ? scanResult.estimated_area : null;
      const clutterModifier = useScan ? (scanResult.price_modifier ?? 1.0) : null;

      const { data, error: apiError } = await pricingApi.estimatePrice(
        category,
        parseInt(rooms || 1, 10),
        parseInt(toilets || 0, 10),
        extras || {},
        parseInt(clothesCount || 0, 10),
        true,
        'normal',
        distanceKm ?? null,
        useScan,
        areaM2,
      );

      if (cancelled) return;

      if (apiError) {
        setError(apiError);
        setLoading(false);
        return;
      }

      const total = data?.total ?? 0;
      const items = data?.breakdown ?? [];

      setEstimate(total);
      setTransportFee(data?.transport_fee ?? 0);
      setBreakdown(items);
      setLoading(false);
    };

    fetchEstimate();
    return () => { cancelled = true; };
  }, [category, rooms, toilets, clothesCount, JSON.stringify(extras), distanceKm, scanResult?.estimated_area]);

  return (
    <ScreenWrapper title="Price Estimate" showBack padding={0} style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: spacing.md }}>

        {/* Service Details */}
        <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.sm }}>
          Service Details
        </AppText>
        <AppCard style={{ marginBottom: spacing.md }}>
          <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginBottom: spacing.xs }}>
            Service: {getServiceLabel(category)}
          </AppText>
          <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginBottom: spacing.xs }}>
            Date: {date} at {time}
          </AppText>
          <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginBottom: spacing.xs }}>
            Address: {address}
          </AppText>
          {notes ? (
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              Notes: {notes}
            </AppText>
          ) : null}
        </AppCard>

        {/* Transport fee notice */}
        {distanceKm != null && (
          <AppCard style={{ marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: transportFee > 0 ? colors.warning ?? '#F59E0B' : colors.primary }}>
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {transportFee > 0
                ? `Janitor is ${Number(distanceKm).toFixed(1)} km away — transport fee of ${formatPrice(transportFee)} included.`
                : `Janitor is ${Number(distanceKm).toFixed(1)} km away — no transport fee.`}
            </AppText>
          </AppCard>
        )}

        {/* Room Scan Results (if scan was used) */}
        {scanResult && (
          <>
            <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.sm }}>
              Room Scan Analysis
            </AppText>
            <AppCard style={{ marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>Estimated Area</AppText>
                <AppText variant="bodyMedium" style={{ color: colors.onSurface, fontWeight: '600' }}>
                  {scanResult.estimated_area} m{'²'}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>Room Size</AppText>
                <AppText variant="bodyMedium" style={{ color: colors.onSurface, fontWeight: '600' }}>
                  {scanResult.room_size}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>Clutter Level</AppText>
                <AppText variant="bodyMedium" style={{ color: colors.onSurface, fontWeight: '600' }}>
                  {scanResult.clutter_level}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>Price Modifier</AppText>
                <AppText variant="bodyMedium" style={{ color: colors.primary, fontWeight: '700' }}>
                  x{scanResult.price_modifier}
                </AppText>
              </View>
              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm, fontStyle: 'italic' }}>
                {scanResult.analysis_mode === 'dimensions'
                  ? 'Based on your manual measurements.'
                  : 'AI-estimated from room photo. Confidence: ' + Math.round((scanResult.confidence || 0) * 100) + '%'}
              </AppText>
            </AppCard>
          </>
        )}

        {/* Cost Breakdown */}
        <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.sm }}>
          Cost Breakdown
        </AppText>
        <AppCard style={{ marginBottom: spacing.lg }}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : error ? (
            <AppText variant="bodySmall" style={{ color: colors.error }}>
              Failed to fetch estimate. Please try again.
            </AppText>
          ) : (
            <>
              {breakdown.map((item, idx) => (
                <AppText
                  key={idx}
                  variant="bodyMedium"
                  style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}
                >
                  {typeof item === 'string' ? item : `${item.label}: ${formatPrice(item.amount)}`}
                </AppText>
              ))}
              <View
                style={{
                  borderTopColor: colors.outlineVariant,
                  borderTopWidth: 1,
                  marginTop: spacing.sm,
                  paddingTop: spacing.sm,
                }}
              >
                <AppText variant="titleLarge" style={{ color: colors.primary, fontWeight: 'bold' }}>
                  Total: {formatPrice(estimate)}
                </AppText>
              </View>
            </>
          )}
        </AppCard>

        <AppButton
          title="Continue to Select Janitor"
          disabled={loading || !!error}
          onPress={() =>
            navigation.navigate('NearbyJanitors', {
              category,
              rooms: parseInt(rooms || 1, 10),
              toilets: parseInt(toilets || 0, 10),
              clothesCount: parseInt(clothesCount || 0, 10),
              extras,
              date,
              time,
              notes,
              address,
              userLocation,
              priceEstimate: estimate,
              breakdown,
              scanResult,
              useScan: !!(scanResult?.estimated_area),
              areaM2: scanResult?.estimated_area ?? null,
            })
          }
        />
      </View>
    </ScreenWrapper>
  );
}
