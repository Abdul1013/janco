import React from 'react';
import { Alert, FlatList, RefreshControl, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import { useAuth } from '../../hooks/authContext';
import { useJanitorProfile } from '../../hooks/useJanitors';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppCard from '../../components/ui/AppCard';
import AppText from '../../components/ui/AppText';
import AppButton from '../../components/ui/AppButton';
import EmptyState from '../../components/ui/EmptyState';

const STATUS_META = {
  pending:     { label: 'New',       bg: '#FFF3E0', text: '#E65100' },
  confirmed:   { label: 'Confirmed', bg: '#E3F2FD', text: '#1565C0' },
  in_progress: { label: 'Active',    bg: '#E8F5E9', text: '#2E7D32' },
  completed:   { label: 'Completed', bg: '#F3E5F5', text: '#6A1B9A' },
  cancelled:   { label: 'Cancelled', bg: '#FFEBEE', text: '#B71C1C' },
};

export default function JanitorDashBoardScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const { profile: authProfile } = useAuth();
  const {
    profile, availability, updateAvailability,
    jobs, loading, refresh, refreshing,
    acceptJob, startJob, completeJob,
  } = useJanitorProfile(authProfile?.id);

  const activeJobs  = jobs.filter(j => j.status === 'in_progress');
  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const displayJobs = [...activeJobs, ...pendingJobs].slice(0, 5);

  const toggleAvailability = () => {
    const next = !availability;
    updateAvailability(next);
    Alert.alert(
      'Availability Updated',
      next ? 'You are now visible to customers.' : 'You are now offline.',
    );
  };

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
    const isPending   = item.status === 'pending';
    const isConfirmed = item.status === 'confirmed';
    const isActive    = item.status === 'in_progress';

    return (
      <AppCard elevation={1} style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '700', textTransform: 'capitalize' }}>
              {(item.service_type || 'Service').replace(/_/g, ' ')}
            </AppText>
            {item.customer_name ? (
              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                {item.customer_name}
              </AppText>
            ) : null}
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {item.scheduled_date
                ? new Date(item.scheduled_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
                : '—'}
              {item.scheduled_time ? `  ·  ${item.scheduled_time}` : ''}
            </AppText>
            {item.address ? (
              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
                {item.address}
              </AppText>
            ) : null}
          </View>
          <View style={{ backgroundColor: meta.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <AppText variant="bodySmall" style={{ color: meta.text, fontWeight: '700', fontSize: 11 }}>
              {meta.label}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
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
          {isPending && (
            <AppButton
              title="Accept"
              onPress={() => handleAction('Accept Job', acceptJob, item.id)}
              style={{ flex: 1, minHeight: 36 }}
            />
          )}
          {isConfirmed && (
            <AppButton
              title="Start"
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

  return (
    <ScreenWrapper refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      {/* Greeting */}
      <View style={{ marginBottom: spacing.md }}>
        <AppText variant="headlineSmall" style={{ color: colors.onBackground, fontWeight: '700' }}>
          Hello, {profile?.full_name?.split(' ')[0] || authProfile?.full_name?.split(' ')[0] || 'Janitor'} 👋
        </AppText>
        <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {availability ? 'You\'re online and visible to customers' : 'You\'re currently offline'}
        </AppText>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <AppCard elevation={1} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md }}>
          <AppText variant="headlineMedium" style={{ color: colors.primary, fontWeight: '800' }}>
            {activeJobs.length + pendingJobs.length}
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Active</AppText>
        </AppCard>
        <AppCard elevation={1} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md }}>
          <AppText variant="headlineMedium" style={{ color: colors.primary, fontWeight: '800' }}>
            {completedCount}
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Completed</AppText>
        </AppCard>
        <AppCard elevation={1} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md }}>
          <AppText variant="headlineMedium" style={{ color: colors.primary, fontWeight: '800' }}>
            {profile?.avg_rating ? Number(profile.avg_rating).toFixed(1) : '—'}
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Rating</AppText>
        </AppCard>
      </View>

      {/* Availability toggle */}
      <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: availability ? '#22C55E' : colors.onSurfaceVariant,
            }} />
            <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '600' }}>
              {availability ? 'Available for Jobs' : 'Go Online'}
            </AppText>
          </View>
          <Switch
            value={availability}
            onValueChange={toggleAvailability}
            trackColor={{ false: colors.outline, true: colors.primaryContainer }}
            thumbColor={availability ? colors.primary : colors.onSurfaceVariant}
          />
        </View>
        {profile?.trust_tier ? (
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: spacing.xs }}>
            Trust tier: {profile.trust_tier}  ·  Score: {profile.trust_score ?? '—'}
          </AppText>
        ) : null}
      </AppCard>

      {/* Active / pending jobs */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <AppText variant="titleSmall" style={{ color: colors.onBackground, fontWeight: '700' }}>
          Jobs to action
        </AppText>
        {jobs.length > 5 && (
          <AppButton
            title="See all"
            variant="text"
            onPress={() => navigation.navigate('Clean')}
            style={{ minHeight: 32 }}
          />
        )}
      </View>

      <FlatList
        data={displayJobs}
        keyExtractor={item => String(item.id)}
        renderItem={renderJob}
        scrollEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="work-outline"
            title="No active jobs"
            subtitle={availability ? 'New jobs will appear here when customers book.' : 'Go online to start receiving jobs.'}
          />
        }
      />
    </ScreenWrapper>
  );
}
