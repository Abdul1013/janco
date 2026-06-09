import React, { useEffect, useState, useRef } from 'react';
import { Alert, Image, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../constants/theme/ThemeContext';
import * as bookingApi from '../api/bookingApi';
import * as janitorApi from '../api/janitorApi';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppCard from '../components/ui/AppCard';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import Skeleton from '../components/ui/Skeleton';
import StatusTimeline from '../components/job/StatusTimeline';

function formatService(type) {
  return (type || 'Service').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function JobStatusScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, spacing } = useTheme();

  const initialJob = route.params?.job || null;
  const [job, setJob] = useState(initialJob);
  const [janitorProfile, setJanitorProfile] = useState(null);
  const pollRef = useRef(null);

  // Fetch job from API (also used for polling)
  const fetchJob = async (id) => {
    const { data, error } = await bookingApi.getBooking(id);
    if (!error && data) setJob(data?.job || data);
  };

  // Fetch assigned janitor profile for display
  const fetchJanitor = async (janitorId) => {
    const { data } = await janitorApi.getJanitorProfile(janitorId);
    if (data) setJanitorProfile(data);
  };

  useEffect(() => {
    if (!job?.id) return;
    fetchJob(job.id);
    pollRef.current = setInterval(() => fetchJob(job.id), 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job?.id]);

  useEffect(() => {
    const janitorId = job?.janitor_id;
    if (janitorId) fetchJanitor(String(janitorId));
    else setJanitorProfile(null);
  }, [job?.janitor_id]);

  const handleCancel = () => {
    Alert.alert('Cancel Job', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          const { data, error } = await bookingApi.cancelBooking(job.id);
          if (error) {
            Alert.alert('Failed', error);
          } else {
            setJob(data?.job || { ...job, status: 'cancelled' });
            if (pollRef.current) clearInterval(pollRef.current);
            Alert.alert('Cancelled', 'Your booking has been cancelled.');
          }
        },
      },
    ]);
  };

  const canCancel = ['pending', 'confirmed'].includes(job?.status);
  const canChat = !!job?.janitor_id;
  const canRate = job?.status === 'completed' && !!job?.janitor_id;

  const janitorName = janitorProfile?.full_name || 'your janitor';

  if (!job) {
    return (
      <ScreenWrapper title="Job Status" showBack>
        <Skeleton variant="card" />
        <Skeleton variant="list" style={{ marginTop: spacing.md }} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper title="Job Status" showBack>
      {/* Service summary chip */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <AppText variant="titleMedium" style={{ color: colors.onBackground, fontWeight: '600' }}>
          {formatService(job.service_type)}
        </AppText>
        <View style={{
          paddingHorizontal: spacing.sm, paddingVertical: 4,
          borderRadius: 8, backgroundColor: colors.primaryContainer,
        }}>
          <AppText variant="bodySmall" style={{ color: colors.onPrimaryContainer, fontWeight: '700' }}>
            #{String(job.id || '').slice(-6).toUpperCase()}
          </AppText>
        </View>
      </View>

      {/* Status timeline */}
      <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
        <StatusTimeline currentStatus={job.status} timestamps={job.status_timestamps || {}} />
      </AppCard>

      {/* Assigned janitor */}
      <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
        <AppText variant="titleSmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.sm }}>
          Assigned Janitor
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {janitorProfile?.avatar_url ? (
            <Image
              source={{ uri: janitorProfile.avatar_url }}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceVariant }}
            />
          ) : (
            <View style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: colors.primaryContainer,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="person" size={26} color={colors.onPrimaryContainer} />
            </View>
          )}
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '600' }}>
              {janitorProfile?.full_name || (job.janitor_id ? 'Loading...' : 'Pending assignment')}
            </AppText>
            {janitorProfile?.avg_rating ? (
              <AppText variant="bodySmall" style={{ color: '#F59E0B' }}>
                {Number(janitorProfile.avg_rating).toFixed(1)}★  ·  {janitorProfile.trust_tier || ''}
              </AppText>
            ) : null}
          </View>
        </View>
      </AppCard>

      {/* Booking details */}
      <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
        {job.scheduled_date ? <Row label="Date" value={new Date(job.scheduled_date).toDateString()} /> : null}
        {job.scheduled_time ? <Row label="Time" value={job.scheduled_time} /> : null}
        {job.address ? <Row label="Address" value={job.address} /> : null}
        {job.price ? <Row label="Price" value={`₦${Number(job.price).toLocaleString('en-NG')}`} /> : null}
        {job.notes ? <Row label="Notes" value={job.notes} /> : null}
      </AppCard>

      {/* Action buttons */}
      {(canChat || canCancel || canRate) && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {canChat && (
            <AppButton
              title="Chat"
              variant="outlined"
              onPress={() => navigation.navigate('Chat', {
                jobId: job.id,
                janitorId: String(job.janitor_id),
                janitorName,
              })}
              style={{ flex: 1 }}
            />
          )}
          {canCancel && (
            <AppButton
              title="Cancel"
              variant="outlined"
              onPress={handleCancel}
              style={{ flex: 1, borderColor: colors.error }}
            />
          )}
          {canRate && (
            <AppButton
              title="Rate Janitor"
              onPress={() => navigation.navigate('Rating', {
                jobId: job.id,
                janitorName,
                serviceType: job.service_type || '',
              })}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </ScreenWrapper>
  );
}

function Row({ label, value }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
      <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{label}</AppText>
      <AppText variant="bodyMedium" style={{ color: colors.onSurface, fontWeight: '500', maxWidth: '60%', textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}
