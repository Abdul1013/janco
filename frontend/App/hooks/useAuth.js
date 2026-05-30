/**
 * useAuth Hook (migrated).
 *
 * Thin wrapper around authStore (Zustand) that preserves the same
 * return shape used by every screen so nothing else needs to change yet.
 *
 * Legacy behaviour:
 *   - Restores session on mount via authStore.initialize()
 *   - Exposes { user, profile, loading, logout, getUserProfile }
 *
 * All direct supabase.auth.* / supabase.from('profiles') calls have
 * been removed — everything goes through the API client now.
 *
 * @module hooks/useAuth
 */

import { useEffect } from 'react';
import useAuthStore from '../store/authStore';

export function useAuth() {
  const {
    user,
    profile,
    loading,
    initialized,
    initialize,
    logout,
    updateProfile,
  } = useAuthStore();

  // Restore session once on first mount
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  /**
   * Backward-compatible helper.
   * Screens like RegistrationScreen call getUserProfile(userId).
   * Now we just return the profile already in the store (it's fetched
   * during initialize / login / signup).  If a fresh fetch is needed
   * the screen should call authStore.initialize() again.
   */
  const getUserProfile = async (_userId) => {
    return profile;
  };

  return {
    user,
    profile,
    loading: loading || !initialized,
    logout,
    getUserProfile,
    updateProfile,
  };
}
