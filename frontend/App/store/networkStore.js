/**
 * Network Store (Zustand).
 *
 * Tracks online/offline state via @react-native-community/netinfo.
 * Manages the offline mutation queue — when the device reconnects,
 * queued requests are replayed in order.
 *
 * Call `useNetworkStore.getState().startListening()` once on app boot
 * to begin monitoring connectivity.
 *
 * Usage:
 *   import useNetworkStore from '../store/networkStore';
 *   const { isOnline } = useNetworkStore();
 *
 * @module store/networkStore
 */

import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

let _unsubscribe = null;

const useNetworkStore = create((set, get) => ({
  isOnline: true,
  offlineQueue: [],

  /**
   * Start listening to NetInfo connectivity changes.
   * Call once on app mount.
   */
  startListening: () => {
    if (_unsubscribe) return; // already listening
    _unsubscribe = NetInfo.addEventListener((state) => {
      get().setOnline(!!state.isConnected);
    });
  },

  /** Stop listening (cleanup). */
  stopListening: () => {
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
  },

  /**
   * Update connectivity status. Triggers queue flush when going online.
   * @param {boolean} online
   */
  setOnline: async (online) => {
    const wasOffline = !get().isOnline;
    set({ isOnline: online });

    if (online && wasOffline) {
      await get().flushQueue();
    }
  },

  /**
   * Add a failed mutation to the offline queue.
   * @param {{ method: string, path: string, body?: Object }} request
   */
  enqueueRequest: (request) => {
    set((state) => ({
      offlineQueue: [...state.offlineQueue, request],
    }));
  },

  /**
   * Replay all queued mutations in order.
   * Shows a toast-like alert for the user.
   */
  flushQueue: async () => {
    const { offlineQueue } = get();
    if (offlineQueue.length === 0) return;

    // Dynamic import to avoid circular dependency
    const { default: client } = await import('../../api/client');

    const total = offlineQueue.length;
    const remaining = [];

    for (const req of offlineQueue) {
      const fn = client[req.method];
      if (fn) {
        const { error } = await fn(req.path, req.body);
        if (error) {
          remaining.push(req);
        }
      }
    }

    set({ offlineQueue: remaining });

    const synced = total - remaining.length;
    if (synced > 0) {
      Alert.alert('Back Online', `Synced ${synced} pending change${synced > 1 ? 's' : ''}.`);
    }
    if (remaining.length > 0) {
      Alert.alert('Sync Issue', `${remaining.length} change${remaining.length > 1 ? 's' : ''} could not be synced.`);
    }
  },
}));

export default useNetworkStore;
