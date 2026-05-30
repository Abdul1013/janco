import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import { useAuth } from '../../hooks/authContext';
import { useJanitorProfile } from '../../hooks/useJanitors';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppCard from '../../components/ui/AppCard';
import AppText from '../../components/ui/AppText';
import AppButton from '../../components/ui/AppButton';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'pending',     label: 'New' },
  { key: 'confirmed',   label: 'Confirmed' },
  { key: 'in_progress', label: 'Active' },
  { key: 'completed',   label: 'Done' },
];

const STATUS_META = {
  pending:     { label: 'New',         bg: '#FFF3E0', text: '#E65100' },
  confirmed:   { label: 'Confirmed',   bg: '#E3F2FD', text: '#1565C0' },
  in_progress: { label: 'Active',      bg: '#E8F5E9', text: '#2E7D32' },
  completed:   { label: 'Completed',   bg: '#F3E5F5', text: '#6A1B9A' },
  cancelled:   { label: 'Cancelled',   bg: '#FFEBEE', text: '#B71C1C' },
};

const SERVICE_ICONS = {
  house_cleaning:    'home',
  deep_cleaning:     'cleaning-services',
  laundry:           'local-laundry-service',
  fumigation:        'pest-control',
  post_construction: 'construction',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function JanitorScheduleScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const { jobs, loading, refreshing, refresh, acceptJob, startJob, completeJob } =
    useJanitorProfile(user?.id);
  const [filter, setFilter] = useState('all');

  const filteredJobs = jobs.filter(j =>
    filter === 'all' ? true : j.status === filter
  );

  const newCount = jobs.filter(j => j.status === 'pending').length;
  const activeCount = jobs.filter(j => j.status === 'in_progress').length;

  const handleAction = (label, action, jobId) => {
    Alert.alert(label, 'Confirm action?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          const err = await action(jobId);
          if (err) Alert.alert('Failed', err);
        },
      },
    ]);
  };

  const renderJob = ({ item }) => {
    const meta = STATUS_META[item.status] || STATUS_META.pending;
    const icon = SERVICE_ICONS[item.service_type] || 'cleaning-services';
    const isActive = item.status === 'in_progress';
    const isPending = item.status === 'pending';
    const isConfirmed = item.status === 'confirmed';
    const isDone = ['completed', 'cancelled'].includes(item.status);

    return (
      <AppCard
        elevation={1}
        style={{
          marginBottom: spacing.sm,
          borderLeftWidth: 3,
          borderLeftColor: isActive ? colors.primary : isPending ? '#E65100' : colors.outlineVariant,
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}>
          <View style={{
            width: 42, height: 42, borderRadius: 10,
            backgroundColor: colors.primaryContainer,
            alignItems: 'center', justifyContent: 'center',
            marginRight: spacing.sm,
          }}>
            <MaterialIcons name={icon} size={22} color={colors.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '700', textTransform: 'capitalize' }}>
                {(item.service_type || 'Service').replace(/_/g, ' ')}
              </AppText>
              <View style={{ backgroundColor: meta.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <AppText variant="bodySmall" style={{ color: meta.text, fontWeight: '700', fontSize: 11 }}>
                  {meta.label}
                </AppText>
              </View>
            </View>

            {/* Customer */}
            {item.customer_name ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <MaterialIcons name="person" size={13} color={colors.onSurfaceVariant} />
                <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginLeft: 4 }}>
                  {item.customer_name}
                </AppText>
              </View>
            ) : null}

            {/* Date & time */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <MaterialIcons name="event" size={13} color={colors.onSurfaceVariant} />
              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginLeft: 4 }}>
                {formatDate(item.scheduled_date)}
                {item.scheduled_time ? `  ·  ${item.scheduled_time}` : ''}
              </AppText>
            </View>

            {/* Address */}
            {item.address ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <MaterialIcons name="place" size={13} color={colors.onSurfaceVariant} />
                <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginLeft: 4, flex: 1 }} numberOfLines={1}>
                  {item.address}
                </AppText>
              </View>
            ) : null}

            {/* Price */}
            {item.price ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <MaterialIcons name="payments" size={13} color={colors.primary} />
                <AppText variant="bodySmall" style={{ color: colors.primary, marginLeft: 4, fontWeight: '700' }}>
                  ₦{Number(item.price).toLocaleString('en-NG')}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {/* Chat — always visible if not cancelled */}
          {!isDone || item.status === 'completed' ? (
            <AppButton
              title="Chat"
              variant="outlined"
              onPress={() => navigation.navigate('Chat', {
                jobId: item.id,
                role: 'janitor',
                otherName: item.customer_name || 'Customer',
              })}
              style={{ flex: 1, minHeight: 36 }}
            />
          ) : null}

          {/* Status progression */}
          {isPending && (
            <AppButton
              title="Accept"
              onPress={() => handleAction('Accept Job', acceptJob, item.id)}
              style={{ flex: 1, minHeight: 36 }}
            />
          )}
          {isConfirmed && (
            <AppButton
              title="Start Job"
              onPress={() => handleAction('Start Job', startJob, item.id)}
              style={{ flex: 1, minHeight: 36 }}
            />
          )}
          {isActive && (
            <AppButton
              title="Complete"
              onPress={() => handleAction('Mark Complete', completeJob, item.id)}
              style={{ flex: 1, minHeight: 36 }}
            />
          )}
        </View>
      </AppCard>
    );
  };

  const filterChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm }}
      style={{ flexShrink: 0 }}
    >
      {FILTERS.map(f => {
        const active = filter === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 1,
              height: 32,
              borderRadius: 20,
              backgroundColor: active ? colors.primary : 'transparent',
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.outline,
            }}
          >
            <AppText
              variant="bodySmall"
              style={{ color: active ? colors.onPrimary : colors.onSurfaceVariant, fontWeight: active ? '700' : '400' }}
            >
              {f.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <ScreenWrapper scrollable={false} padding={0}>
      {/* Title + summary */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs }}>
        <AppText variant="headlineSmall" style={{ color: colors.onBackground, fontWeight: '700' }}>
          My Schedule
        </AppText>
        {(newCount > 0 || activeCount > 0) && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            {newCount > 0 && (
              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                <AppText variant="bodySmall" style={{ color: '#E65100', fontWeight: '700' }}>
                  {newCount} new
                </AppText>
              </View>
            )}
            {activeCount > 0 && (
              <View style={{ backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                <AppText variant="bodySmall" style={{ color: '#2E7D32', fontWeight: '700' }}>
                  {activeCount} active
                </AppText>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Filter chips */}
      {filterChips}

      {/* Jobs list */}
      {loading ? (
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={item => String(item.id)}
          renderItem={renderJob}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="event-busy"
              title={filter === 'all' ? 'No jobs yet' : `No ${FILTERS.find(f => f.key === filter)?.label.toLowerCase()} jobs`}
              subtitle={filter === 'all' ? 'Jobs assigned to you will appear here once a customer books.' : 'Nothing in this status right now.'}
            />
          }
        />
      )}
    </ScreenWrapper>
  );
}
