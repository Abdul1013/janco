/**
 * Booking Store (Zustand).
 *
 * Manages the multi-step booking flow state so screens don't need to
 * pass 12+ params through navigation.
 *
 * Usage:
 *   import useBookingStore from '../store/bookingStore';
 *   const { serviceType, setServiceDetails, submitBooking } = useBookingStore();
 *
 * @module store/bookingStore
 */

import { create } from 'zustand';
import * as bookingApi from '../api/bookingApi';
import * as pricingApi from '../api/pricingApi';

const useBookingStore = create((set, get) => ({
  // Flow state
  currentStep: 1,
  serviceType: '',
  rooms: 1,
  toilets: 0,
  extras: {},
  clothesCount: 0,
  scheduledDate: '',
  scheduledTime: '',
  address: '',
  latitude: null,
  longitude: null,
  notes: '',

  // Janitor selection
  selectedJanitor: null,

  // Pricing
  priceEstimate: null,
  priceLoading: false,

  // Submission
  isSubmitting: false,
  error: null,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Advance or go to a specific step. */
  setStep: (step) => set({ currentStep: step }),

  /** Set service details (step 1 → 2). */
  setServiceDetails: (details) =>
    set({
      serviceType: details.serviceType ?? get().serviceType,
      rooms: details.rooms ?? get().rooms,
      toilets: details.toilets ?? get().toilets,
      extras: details.extras ?? get().extras,
      clothesCount: details.clothesCount ?? get().clothesCount,
    }),

  /** Set schedule and location (step 2 → 3). */
  setSchedule: (schedule) =>
    set({
      scheduledDate: schedule.date ?? get().scheduledDate,
      scheduledTime: schedule.time ?? get().scheduledTime,
      address: schedule.address ?? get().address,
      latitude: schedule.latitude ?? get().latitude,
      longitude: schedule.longitude ?? get().longitude,
      notes: schedule.notes ?? get().notes,
    }),

  /** Select a janitor (step 3 → 4). */
  setJanitor: (janitor) => set({ selectedJanitor: janitor }),

  /** Fetch price estimate from backend. */
  fetchPriceEstimate: async () => {
    const { serviceType, rooms, toilets, extras, clothesCount } = get();
    set({ priceLoading: true, error: null });

    const { data, error } = await pricingApi.estimatePrice(
      serviceType, rooms, toilets, extras, clothesCount,
    );

    if (error) {
      set({ priceLoading: false, error });
      return;
    }
    set({ priceEstimate: data, priceLoading: false });
  },

  /** Submit the booking to the backend. */
  submitBooking: async () => {
    const state = get();
    set({ isSubmitting: true, error: null });

    const { data, error } = await bookingApi.createBooking({
      service_type: state.serviceType,
      rooms: state.rooms,
      toilets: state.toilets,
      extras: state.extras,
      scheduled_date: state.scheduledDate,
      scheduled_time: state.scheduledTime,
      address: state.address,
      latitude: state.latitude,
      longitude: state.longitude,
      janitor_id: state.selectedJanitor?.janitor_id ?? null,
      notes: state.notes,
    });

    if (error) {
      set({ isSubmitting: false, error });
      return { error };
    }

    set({ isSubmitting: false });
    get().reset();
    return { data, error: null };
  },

  /** Reset the entire booking flow. */
  reset: () =>
    set({
      currentStep: 1,
      serviceType: '',
      rooms: 1,
      toilets: 0,
      extras: {},
      clothesCount: 0,
      scheduledDate: '',
      scheduledTime: '',
      address: '',
      latitude: null,
      longitude: null,
      notes: '',
      selectedJanitor: null,
      priceEstimate: null,
      priceLoading: false,
      isSubmitting: false,
      error: null,
    }),
}));

export default useBookingStore;
