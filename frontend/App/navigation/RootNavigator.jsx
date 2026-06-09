/**
 * Root Navigator
 *
 * Determines which stack to show based on authStore state:
 *   - Loading → SplashScreen
 *   - No user → AuthStack (Login, Signup, ForgotPassword)
 *   - User without profile → Registration screen
 *   - Authenticated → MainStack (tabs + nested screens)
 *
 * Deep-linking config is included for push-notification payloads.
 *
 * @module navigation/RootNavigator
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/authContext';
import { useTheme } from '../constants/theme/ThemeContext';
import useNotifications from '../hooks/useNotifications';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgetPasswordScreen from '../screens/auth/ForgetPasswordScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import UpdatePasswordScreen from '../screens/auth/UpdatePasswordScreen';
import AuthCallbackScreen from '../screens/AuthCallbackScreen';

// Main screens
import TabNavigator from './TabNavigator';
import PriceEstimateScreen from '../screens/PriceEstimateScreen';
import NearbyJanitors from '../screens/NearbyJanitorsScreen';
import ChatScreen from '../screens/ChatScreen';
import JobStatusScreen from '../screens/JobStatusScreen';
import SplashScreen from '../screens/SplashScreen';

// Janitor screens
import JanitorRegistrationScreen from '../screens/Janitor/JanitorRegistrationScreen';
import JanitorStatusScreen from '../screens/Janitor/JanitorStatusScreen';
import JanitorDashBoardScreen from '../screens/Janitor/JanitorDashBoardScreen';
import VerificationScreen from '../screens/Janitor/VerificationScreen';

// Room Scan
import RoomScanScreen from '../screens/RoomScanScreen';

// Payment
import PaymentScreen from '../screens/PaymentScreen';

// Rating
import RatingScreen from '../screens/RatingScreen';

// Shared
import OfflineBanner from '../components/ui/OfflineBanner';
import BookingHistoryScreen from '../screens/BookingHistoryScreen';

// ---------------------------------------------------------------------------
// Stacks
// ---------------------------------------------------------------------------
const AuthStackNav = createNativeStackNavigator();
const MainStackNav = createNativeStackNavigator();

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Signup" component={SignupScreen} />
      <AuthStackNav.Screen name="ForgotPassword" component={ForgetPasswordScreen} />
      <AuthStackNav.Screen name="UpdatePassword" component={UpdatePasswordScreen} />
      <AuthStackNav.Screen name="AuthCallback" component={AuthCallbackScreen} />
    </AuthStackNav.Navigator>
  );
}

function MainStack() {
  return (
    <MainStackNav.Navigator screenOptions={{ headerShown: false }}>
      {/* Bottom tabs */}
      <MainStackNav.Screen name="MainTabs" component={TabNavigator} />

      {/* Profile / registration */}
      <MainStackNav.Screen name="Registration" component={RegistrationScreen} />

      {/* Booking flow */}
      <MainStackNav.Screen name="PriceEstimate" component={PriceEstimateScreen} />
      <MainStackNav.Screen name="RoomScan" component={RoomScanScreen} />
      <MainStackNav.Screen name="NearbyJanitors" component={NearbyJanitors} />
      <MainStackNav.Screen name="JobStatus" component={JobStatusScreen} />
      <MainStackNav.Screen name="Chat" component={ChatScreen} />
      <MainStackNav.Screen name="Bookings" component={BookingHistoryScreen} />

      {/* Payment */}
      <MainStackNav.Screen name="Payment" component={PaymentScreen} />

      {/* Rating */}
      <MainStackNav.Screen name="Rating" component={RatingScreen} />

      {/* Janitor flow */}
      <MainStackNav.Screen name="JanitorRegistration" component={JanitorRegistrationScreen} />
      <MainStackNav.Screen name="JanitorStatus" component={JanitorStatusScreen} />
      <MainStackNav.Screen name="JanitorDashBoard" component={JanitorDashBoardScreen} />
      <MainStackNav.Screen name="Verification" component={VerificationScreen} />
    </MainStackNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function RootNavigator() {
  const { user, profile, loading } = useAuth();
  const { colors } = useTheme();

  // Register push notification token and wire up notification tap handlers.
  // Must be called here (inside NavigationContainer) so useNavigation() works.
  useNotifications();

  // Still restoring tokens
  if (loading) return <SplashScreen />;

  return (
    <>
      <OfflineBanner />
      {!user ? (
        <AuthStack />
      ) : user && !profile?.is_registered ? (
        <RegistrationScreen />
      ) : (
        <MainStack />
      )}
    </>
  );
}

/**
 * Deep-linking configuration for push notifications.
 * Use with NavigationContainer's `linking` prop.
 */
export const linking = {
  prefixes: ['janco://', 'https://janco.app'],
  config: {
    screens: {
      Login: 'login',
      Signup: 'signup',
      MainTabs: {
        screens: {
          HomeScreen: 'home',
          Clean: 'book',
          Bookings: 'bookings',
          Profile: 'profile',
        },
      },
      JobStatus: 'job/:jobId',
      Chat: 'chat/:jobId',
      Rating: 'rate/:jobId',
      Verification: 'verification',
      JanitorDashBoard: 'janitor/dashboard',
    },
  },
};
