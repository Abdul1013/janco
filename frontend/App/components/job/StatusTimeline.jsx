/**
 * StatusTimeline — reusable vertical timeline for job status.
 *
 * Props:
 *   - currentStatus: string (pending|confirmed|in_progress|completed|cancelled)
 *   - timestamps?: { [status]: string } — ISO strings for when each step was reached
 *
 * @module components/job/StatusTimeline
 */

import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import AppText from '../ui/AppText';

const STEPS = [
  { key: 'pending', label: 'Pending', icon: 'schedule' },
  { key: 'confirmed', label: 'Confirmed', icon: 'check-circle-outline' },
  { key: 'in_progress', label: 'In Progress', icon: 'cleaning-services' },
  { key: 'completed', label: 'Completed', icon: 'done-all' },
];

const ORDER = STEPS.map((s) => s.key);

export default function StatusTimeline({ currentStatus, timestamps = {} }) {
  const { colors, spacing } = useTheme();
  const currentIdx = ORDER.indexOf(currentStatus);
  const isCancelled = currentStatus === 'cancelled';

  return (
    <View>
      {STEPS.map((step, idx) => {
        const reached = !isCancelled && idx <= currentIdx;
        const active = !isCancelled && idx === currentIdx;
        const lineColor = reached ? colors.primary : colors.outlineVariant;
        const dotColor = reached ? colors.primary : colors.outlineVariant;
        const textColor = reached ? colors.onSurface : colors.onSurfaceVariant;

        return (
          <View key={step.key} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            {/* Dot + Line */}
            <View style={{ alignItems: 'center', width: 32 }}>
              <View
                style={{
                  width: active ? 28 : 20,
                  height: active ? 28 : 20,
                  borderRadius: 14,
                  backgroundColor: dotColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons
                  name={reached ? step.icon : 'radio-button-unchecked'}
                  size={active ? 16 : 12}
                  color={reached ? colors.onPrimary : colors.onSurfaceVariant}
                />
              </View>
              {idx < STEPS.length - 1 && (
                <View style={{ width: 2, height: 36, backgroundColor: lineColor }} />
              )}
            </View>

            {/* Label + timestamp */}
            <View style={{ marginLeft: spacing.sm, paddingBottom: spacing.md }}>
              <AppText
                variant="bodyLarge"
                style={{ color: textColor, fontWeight: active ? '700' : '400' }}
              >
                {step.label}
              </AppText>
              {timestamps[step.key] ? (
                <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                  {new Date(timestamps[step.key]).toLocaleString()}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}

      {isCancelled && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <MaterialIcons name="cancel" size={24} color={colors.error} />
          <AppText variant="bodyLarge" style={{ color: colors.error, marginLeft: spacing.sm, fontWeight: '700' }}>
            Cancelled
          </AppText>
        </View>
      )}
    </View>
  );
}
