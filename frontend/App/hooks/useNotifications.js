/**
 * useNotifications Hook — Sprint 4 Day 23.
 *
 * Manages push notification registration, permissions, and
 * notification-tap navigation.
 *
 * Responsibilities:
 *   - Request notification permissions on mount
 *   - Register Expo push token with the backend
 *   - Handle incoming notifications (foreground + background)
 *   - Navigate to relevant screen on notification tap
 *
 * Uses authApi.updateProfile() to store push token — zero direct Supabase.
 *
 * @module hooks/useNotifications
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useNavigation } from '@react-navigation/native';
import * as authApi from '../../api/authApi';

// Configure how notifications are handled in the foreground.
// Guarded: in Expo Go (SDK 53+) parts of expo-notifications are removed and can
// throw — that must never crash app startup. Use the SDK 54 handler keys
// (shouldShowBanner/shouldShowList) plus the legacy key for back-compat.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  // no-op — notifications not available in this runtime (e.g. Expo Go)
}

/**
 * Hook that manages push notification lifecycle.
 *
 * @returns {{ expoPushToken: string|null, notification: Object|null }}
 *
 * @example
 *   const { expoPushToken } = useNotifications();
 */
export default function useNotifications() {
  const navigation = useNavigation();
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notification, setNotification] = useState(null);

  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // The entire registration path is guarded: expo-notifications APIs can throw
    // in Expo Go (SDK 53+). A failure here must never break app startup.
    try {
      // Register for push notifications (already internally try/caught)
      registerForPushNotifications().then((token) => {
        if (token) {
          setExpoPushToken(token);
          // Store token on the backend via profile update
          authApi.updateProfile({ push_token: token });
        }
      }).catch(() => {});

      // Listener: notification received while app is in foreground
      notificationListener.current = Notifications.addNotificationReceivedListener(
        (incomingNotification) => {
          setNotification(incomingNotification);
        },
      );

      // Listener: user tapped on a notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          handleNotificationTap(response.notification.request.content.data);
        },
      );
    } catch (e) {
      // Notifications unavailable in this runtime (e.g. Expo Go) — ignore.
    }

    return () => {
      try {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      } catch (e) {
        // ignore teardown errors
      }
    };
  }, []);

  /**
   * Navigate to the appropriate screen based on notification data payload.
   * @param {Object} data - The notification data object.
   */
  const handleNotificationTap = (data) => {
    if (!data) return;

    switch (data.type) {
      case 'job_status':
      case 'job_reminder':
        navigation.navigate('JobStatus', { jobId: data.job_id });
        break;

      case 'chat':
        navigation.navigate('Chat', { jobId: data.job_id });
        break;

      case 'new_booking':
        navigation.navigate('JanitorDashBoard');
        break;

      case 'verification':
        navigation.navigate('Verification');
        break;

      default:
        // Fallback: go to home
        navigation.navigate('Home');
        break;
    }
  };

  return { expoPushToken, notification };
}

// ---------------------------------------------------------------------------
// Helper: register for Expo push notifications
// ---------------------------------------------------------------------------

/**
 * Request push notification permissions and get the Expo push token.
 * @returns {Promise<string|null>} The Expo push token or null if unavailable.
 */
async function registerForPushNotifications() {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Android: set notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'JANCO Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6750A4',
      });
    }

    return token;
  } catch {
    return null;
  }
}
