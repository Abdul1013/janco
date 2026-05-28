/**
 * Auth Store (Zustand).
 *
 * Manages user authentication state: tokens, profile, loading/error.
 * Persists tokens to AsyncStorage for session persistence.
 * Registers token accessors with the API client for automatic JWT injection.
 *
 * @module store/authStore
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authApi from '../api/authApi';
import { registerAuthHandlers } from '../api/client';

const TOKEN_KEY = '@janco_tokens';

const useAuthStore = create((set, get) => ({
  // State
  user: null,
  profile: null,
  tokens: { access: null, refresh: null },
  loading: false,
  error: null,
  initialized: false,


// Actions


  /**
   * Restore tokens from AsyncStorage on app launch.
   * If tokens exist, fetch the profile.
   */
  initialize: async () => {
    try {
      const raw = await AsyncStorage.getItem(TOKEN_KEY);
      if (raw) {
        const tokens = JSON.parse(raw);
        set({ tokens });

        // Register with API client so requests include JWT
        _registerClient(get);

        // Try to fetch profile with stored token
        const { data, error } = await authApi.getProfile();
        if (data && !error) {
          set({ profile: data, user: data, initialized: true });
        } else {
          // Token expired — clear
          await get().clearAuth();
          set({ initialized: true });
        }
      } else {
        set({ initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  /**
   * Sign up a new user.
   * @param {string} email
   * @param {string} password
   * @param {string} fullName
   */
  signup: async (email, password, fullName) => {
    set({ loading: true, error: null });
    const { data, error } = await authApi.signup(email, password, fullName);

    if (error) {
      set({ loading: false, error });
      return { error };
    }

    const tokens = {
      access: data.access_token,
      refresh: data.refresh_token,
    };
    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    set({ tokens, loading: false });
    _registerClient(get);

    // Fetch full profile
    const profile = await authApi.getProfile();
    if (profile.data) set({ profile: profile.data, user: profile.data });

    return { error: null };
  },

  /**
   * Log in with email and password.
   * @param {string} email
   * @param {string} password
   */
  login: async (email, password) => {
    set({ loading: true, error: null });
    const { data, error } = await authApi.login(email, password);

    if (error) {
      set({ loading: false, error });
      return { error };
    }

    const tokens = {
      access: data.access_token,
      refresh: data.refresh_token,
    };
    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    set({ tokens, profile: data.user, user: data.user, loading: false });
    _registerClient(get);

    return { error: null };
  },

  /**
   * Refresh the JWT using the stored refresh token.
   * @returns {Promise<string>} New access token.
   */
  refreshToken: async () => {
    const { tokens } = get();
    if (!tokens.refresh) throw new Error('No refresh token');

    const { data, error } = await authApi.refreshToken(tokens.refresh);
    if (error) throw new Error(error);

    const newTokens = {
      access: data.access_token,
      refresh: data.refresh_token,
    };
    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(newTokens));
    set({ tokens: newTokens });
    return data.access_token;
  },

  /**
   * Update the current user's profile.
   * @param {Object} data - { full_name?, phone?, avatar_url? }
   */
  updateProfile: async (profileData) => {
    set({ loading: true, error: null });
    const { data, error } = await authApi.updateProfile(profileData);
    if (error) {
      set({ loading: false, error });
      return { error };
    }
    set({ profile: data.profile, user: data.profile, loading: false });
    return { error: null };
  },

  /**
   * Log out — clear tokens and state.
   */
  logout: async () => {
    await authApi.logout();
    await get().clearAuth();
  },

  /** Internal: reset auth state. */
  clearAuth: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    set({ user: null, profile: null, tokens: { access: null, refresh: null }, error: null });
  },
}));


// Register token accessors with the API client
function _registerClient(get) {
  registerAuthHandlers(
    () => get().tokens,
    () => get().refreshToken(),
  );
}

export default useAuthStore;
