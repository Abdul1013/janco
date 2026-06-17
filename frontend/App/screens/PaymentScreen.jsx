/**
 * PaymentScreen — Paystack web checkout via WebView.
 *
 * Flow:
 *   1. Screen receives { jobId, price, email } via route params
 *   2. Calls POST /v1/payments/initialize → gets authorization_url
 *   3. Loads the URL in a WebView for Paystack checkout
 *   4. Detects the success/failure redirect (Paystack redirects to callback_url)
 *   5. On success: calls GET /v1/payments/{reference}/verify then navigates to JobStatus
 *
 * Note: Install react-native-webview before using this screen:
 *   npx expo install react-native-webview
 *
 * @module screens/PaymentScreen
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../constants/theme/ThemeContext';
import * as paymentApi from '../api/paymentApi';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';

// Paystack redirects here after checkout — must match callback_url in initialize call
const CALLBACK_URL = 'https://janco.app/payment/callback';

export default function PaymentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, spacing } = useTheme();

  const { jobId, price, jobDetails } = route.params || {};

  const [authUrl, setAuthUrl] = useState(null);
  const [reference, setReference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const hasHandledRef = useRef(false);

  // ── Initialize Paystack transaction ────────────────────────────────────────

  useEffect(() => {
    if (!jobId) {
      setError('Invalid payment request — no job ID.');
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: initError } = await paymentApi.initializePayment(
        jobId,
        CALLBACK_URL,
      );

      if (initError || !data?.authorization_url) {
        setError(initError ?? 'Failed to initialize payment. Please try again.');
        setLoading(false);
        return;
      }

      setAuthUrl(data.authorization_url);
      setReference(data.reference);
      setLoading(false);
    })();
  }, [jobId]);

  // ── Handle payment result ──────────────────────────────────────────────────

  const handlePaymentSuccess = useCallback(async () => {
    if (hasHandledRef.current || !reference) return;
    hasHandledRef.current = true;
    setVerifying(true);

    const { data, error: verifyError } = await paymentApi.verifyPayment(reference);

    setVerifying(false);

    if (verifyError || data?.status !== 'success') {
      Alert.alert(
        'Payment Verification Failed',
        'Your payment could not be confirmed. Please contact support with reference: ' + reference,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
      return;
    }

    Alert.alert(
      'Payment Successful!',
      `₦${price?.toLocaleString() ?? ''} paid successfully.`,
      [
        {
          text: 'Track Job',
          onPress: () =>
            navigation.replace('JobStatus', { jobId, job: jobDetails }),
        },
      ],
    );
  }, [reference, price, jobId, jobDetails, navigation]);

  const handlePaymentFailed = useCallback(() => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Alert.alert(
      'Payment Failed',
      'Your payment could not be processed. Please try again.',
      [{ text: 'Try Again', onPress: () => navigation.goBack() }],
    );
  }, [navigation]);

  // ── Detect redirect from Paystack WebView ─────────────────────────────────

  const handleNavigationChange = useCallback(
    (navState) => {
      const url = navState.url || '';
      if (url.startsWith(CALLBACK_URL)) {
        // Paystack redirected to our callback — check query params
        if (url.includes('trxref=') || url.includes('reference=')) {
          handlePaymentSuccess();
        } else {
          handlePaymentFailed();
        }
      }
    },
    [handlePaymentSuccess, handlePaymentFailed],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || verifying) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText style={{ marginTop: spacing.md, color: colors.textSecondary }}>
            {verifying ? 'Confirming payment…' : 'Preparing checkout…'}
          </AppText>
        </View>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <AppText style={{ color: colors.error, textAlign: 'center', marginBottom: spacing.lg }}>
            {error}
          </AppText>
          <AppButton title="Go Back" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={{ padding: 0 }}>
      {authUrl ? (
        <WebView
          source={{ uri: authUrl }}
          onNavigationStateChange={handleNavigationChange}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          style={{ flex: 1 }}
        />
      ) : null}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
