import { useState, useEffect, useCallback } from 'react';
import * as janitorApi from '../../api/janitorApi';
import * as bookingApi from '../../api/bookingApi';

export const useJanitorProfile = (userId) => {
  const [availability, setAvailability] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await janitorApi.getJanitorProfile(userId);
    if (data && !error) {
      setAvailability(data.availability ?? false);
      setProfile(data);
    }
  }, [userId]);

  // Fetch jobs where janitor_id = current user via /bookings/assigned
  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true);
    const { data } = await bookingApi.getAssignedJobs(1);
    const list = data?.jobs ?? [];
    setJobs(Array.isArray(list) ? list : []);
    if (isRefresh) setRefreshing(false);
  }, [userId]);

  const refresh = useCallback(() => fetchJobs(true), [fetchJobs]);

  const updateAvailability = async (value) => {
    setAvailability(value);
    const { error } = await janitorApi.updateAvailability(value);
    if (error) {
      setAvailability(!value);
    }
  };

  // Accept a pending job (pending → confirmed) via the dedicated janitor endpoint
  const acceptJob = async (jobId) => {
    const { error } = await bookingApi.acceptJob(jobId);
    await fetchJobs(); // always refresh — even on error, stale state may have changed
    return error ? String(error) : null;
  };

  // Reject a pending job — unassigns it for re-matching
  const rejectJob = async (jobId) => {
    const { error } = await bookingApi.rejectJob(jobId);
    await fetchJobs();
    return error ? String(error) : null;
  };

  // Start a confirmed job (confirmed → in_progress)
  const startJob = async (jobId) => {
    const { error } = await bookingApi.updateStatus(jobId, 'in_progress');
    await fetchJobs();
    return error ? String(error) : null;
  };

  // Complete an in-progress job (in_progress → completed)
  const completeJob = async (jobId) => {
    const { error } = await bookingApi.updateStatus(jobId, 'completed');
    await fetchJobs();
    return error ? String(error) : null;
  };

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([fetchProfile(), fetchJobs()]).finally(() => setLoading(false));
  }, [userId]);

  return {
    profile,
    availability,
    updateAvailability,
    jobs,
    loading,
    refreshing,
    refresh,
    acceptJob,
    rejectJob,
    startJob,
    completeJob,
  };
};
