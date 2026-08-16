/**
 * useJobs Hook (migrated).
 *
 * Replaces all direct supabase.from('jobs') calls and 10-second polling
 * with the bookingApi module that goes through the FastAPI backend.
 *
 * Return shape is preserved:
 *   { job, loading, createJob, updateJobStatus, setJobId }
 *
 * @module hooks/useJob
 */

import { useEffect, useState, useCallback } from 'react';
import * as bookingApi from '../../api/bookingApi';
import useNetworkStore from '../store/networkStore';

export default function useJobs(initialJobId = null) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(initialJobId);

  /**
   * Fetch a single job by ID via the API.
   */
  const fetchJob = useCallback(async (id) => {
    const targetId = id ?? jobId;
    if (!targetId) return;

    setLoading(true);
    const { data, error } = await bookingApi.getBooking(targetId);

    if (error) {
      console.error('Fetch Job Error:', error);
    } else {
      setJob(data);
    }
    setLoading(false);
  }, [jobId]);

  /**
   * Poll every 10 seconds while we have a jobId.
   * Note: Polling is used here instead of Realtime because job status
   * changes are infrequent. Push notifications supplement this.
   */
  useEffect(() => {
    if (!jobId) return;
    fetchJob(jobId);

    const interval = setInterval(() => {
      fetchJob(jobId);
    }, 10_000);

    return () => clearInterval(interval);
  }, [jobId, fetchJob]);

  /**
   * Create a new booking via the backend API.
   * The backend auto-calculates price, validates inputs, and
   * assigns the job to the correct user via the JWT.
   *
   * @param {Object} bookingData - Service details, schedule, address, etc.
   * @returns {Object} The created job.
   */
  const createJob = async (bookingData) => {
    setLoading(true);

    const { data, error } = await bookingApi.createBooking(bookingData);

    setLoading(false);

    if (error) {
      // If offline, queue the mutation for later replay
      const { isOnline, enqueueRequest } = useNetworkStore.getState();
      if (!isOnline) {
        enqueueRequest({
          method: 'post',
          path: '/bookings',
          body: bookingData,
        });
      }
      console.error('Job creation failed:', error);
      throw new Error(error);
    }

    const created = data?.job ?? data;
    setJob(created);
    setJobId(created?.id);
    return created;
  };

  /**
   * Update a job's status via the API.
   * @param {string} newStatus - One of: pending, confirmed, in_progress, completed, cancelled
   */
  const updateJobStatus = async (newStatus) => {
    if (!job?.id) return;

    setLoading(true);
    const { data, error } = await bookingApi.updateStatus(job.id, newStatus);
    setLoading(false);

    if (error) {
      console.error('Update Status Error:', error);
    } else {
      const updated = data?.job ?? data;
      setJob(updated);
    }
  };

  return { job, loading, createJob, updateJobStatus, setJobId };
}
