/**
 * RoomScanScreen — AI-powered room scanning with camera.
 *
 * Captures a room photo via expo-camera, sends it to the backend
 * scan engine for area/clutter estimation, and returns the result
 * to the booking flow.
 *
 * Features:
 *  - Live camera preview with crosshair overlay
 *  - Capture button with haptic feedback
 *  - Scan results overlay with area, clutter, price modifier
 *  - Manual dimensions fallback input
 *  - Blurred "LiDAR Scan" coming-soon button
 *  - Retake / Use Results actions
 *
 * @module screens/RoomScanScreen
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../constants/theme/ThemeContext';
import { Spacing } from '../constants/theme';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import AppCard from '../components/ui/AppCard';
import * as roomScanApi from '../api/roomScanApi';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROOM_SIZE_LABELS = {
  small: 'Small (< 15 m²)',
  medium: 'Medium (15–30 m²)',
  large: 'Large (30–50 m²)',
  xl: 'Extra Large (> 50 m²)',
};

const CLUTTER_LABELS = {
  minimal: 'Minimal',
  moderate: 'Moderate',
  heavy: 'Heavy',
  extreme: 'Extreme',
};

const CLUTTER_COLORS = {
  minimal: '#4CAF50',
  moderate: '#FF9800',
  heavy: '#F44336',
  extreme: '#9C27B0',
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function RoomScanScreen({ route }) {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualWidth, setManualWidth] = useState('');
  const [manualLength, setManualLength] = useState('');
  const [manualClutter, setManualClutter] = useState('0.3');

  // Booking params passed from BookingScreen
  const bookingParams = route?.params || {};

  // ── Capture photo ────────────────────────────────────────────────────
  // All hooks must be declared before any conditional returns (Rules of Hooks).
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || scanning) return;

    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      setScanning(true);
      setError(null);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        exif: false,
      });

      const { data, error: apiError } = await roomScanApi.scanImage(
        photo.base64,
        photo.width,
        photo.height,
      );

      if (apiError) {
        setError(apiError);
        setScanning(false);
        return;
      }

      setScanResult(data);
      setScanning(false);
    } catch (err) {
      setError(err.message || 'Failed to capture image');
      setScanning(false);
    }
  }, [scanning]);

  // ── Manual dimensions ────────────────────────────────────────────────
  const handleManualSubmit = useCallback(async () => {
    const w = parseFloat(manualWidth);
    const l = parseFloat(manualLength);
    const c = parseFloat(manualClutter) || 0.3;

    if (!w || !l || w <= 0 || l <= 0) {
      Alert.alert('Invalid Dimensions', 'Please enter valid width and length in metres.');
      return;
    }

    setScanning(true);
    setError(null);
    setShowManual(false);

    const { data, error: apiError } = await roomScanApi.scanDimensions(w, l, c);

    if (apiError) {
      setError(apiError);
      setScanning(false);
      return;
    }

    setScanResult(data);
    setScanning(false);
  }, [manualWidth, manualLength, manualClutter]);

  // ── Use results ──────────────────────────────────────────────────────
  const handleUseResults = useCallback(() => {
    if (!scanResult) return;
    navigation.navigate('PriceEstimate', {
      ...bookingParams,
      scanResult: {
        estimated_area: scanResult.estimated_area,
        room_size: scanResult.room_size,
        clutter_level: scanResult.clutter_level,
        clutter_score: scanResult.clutter_score,
        price_modifier: scanResult.price_modifier,
        confidence: scanResult.confidence,
        analysis_mode: scanResult.analysis_mode,
      },
    });
  }, [scanResult, bookingParams, navigation]);

  // ── Retake ───────────────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setScanResult(null);
    setError(null);
  }, []);

  // ── Camera permission (after all hooks) ─────────────────────────────
  if (!permission) {
    return (
      <ScreenWrapper title="Room Scan" showBack onBack={() => navigation.goBack()}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenWrapper title="Room Scan" showBack onBack={() => navigation.goBack()}>
        <View style={[styles.centered, { padding: spacing.xl }]}>
          <MaterialIcons name="camera-alt" size={64} color={colors.onSurfaceVariant} />
          <AppText
            variant="titleMedium"
            style={{ color: colors.onBackground, textAlign: 'center', marginTop: spacing.md }}
          >
            Camera Access Required
          </AppText>
          <AppText
            variant="bodyMedium"
            style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg }}
          >
            JANCO needs camera access to scan your room and estimate its size and condition for accurate pricing.
          </AppText>
          <AppButton title="Grant Camera Access" onPress={requestPermission} />
          <AppButton
            title="Enter Dimensions Manually"
            variant="outlined"
            onPress={() => setShowManual(true)}
            style={{ marginTop: spacing.sm }}
          />
        </View>
        {renderManualModal()}
      </ScreenWrapper>
    );
  }

  // ── Manual input modal ───────────────────────────────────────────────
  function renderManualModal() {
    return (
      <Modal visible={showManual} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: 16 }]}>
            <AppText variant="titleMedium" style={{ color: colors.onSurface, marginBottom: spacing.md }}>
              Enter Room Dimensions
            </AppText>

            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>
              Width (metres)
            </AppText>
            <TextInput
              style={[styles.input, { borderColor: colors.outline, color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
              value={manualWidth}
              onChangeText={setManualWidth}
              keyboardType="decimal-pad"
              placeholder="e.g. 4.5"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>
              Length (metres)
            </AppText>
            <TextInput
              style={[styles.input, { borderColor: colors.outline, color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
              value={manualLength}
              onChangeText={setManualLength}
              keyboardType="decimal-pad"
              placeholder="e.g. 5.0"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>
              Clutter estimate (0 = empty, 1 = extreme)
            </AppText>
            <TextInput
              style={[styles.input, { borderColor: colors.outline, color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
              value={manualClutter}
              onChangeText={setManualClutter}
              keyboardType="decimal-pad"
              placeholder="0.3"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <AppButton
                title="Cancel"
                variant="outlined"
                onPress={() => setShowManual(false)}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Analyse"
                onPress={handleManualSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Confidence bar ───────────────────────────────────────────────────
  function ConfidenceBar({ value }) {
    const pct = Math.round(value * 100);
    const barColor = pct >= 80 ? '#4CAF50' : pct >= 60 ? '#FF9800' : '#F44336';
    return (
      <View style={{ marginTop: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Confidence</AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurface, fontWeight: '600' }}>{pct}%</AppText>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
      </View>
    );
  }

  // ── Results overlay ──────────────────────────────────────────────────
  if (scanResult) {
    const clutterColor = CLUTTER_COLORS[scanResult.clutter_level] || colors.primary;
    const isPhotoEstimate = scanResult.analysis_mode !== 'dimensions';
    return (
      <ScreenWrapper title="Scan Results" showBack onBack={handleRetake} scrollable>
        {/* Results hero */}
        <View style={[styles.resultsHero, { backgroundColor: colors.primaryContainer }]}>
          <MaterialCommunityIcons name="floor-plan" size={48} color={colors.primary} />
          <AppText variant="headlineSmall" style={{ color: colors.onPrimaryContainer, marginTop: spacing.sm }}>
            {scanResult.estimated_area} m{'²'}
          </AppText>
          <AppText variant="bodyMedium" style={{ color: colors.onPrimaryContainer }}>
            {ROOM_SIZE_LABELS[scanResult.room_size] || scanResult.room_size}
          </AppText>
        </View>

        {/* Detail cards */}
        <AppCard elevation={1} style={{ marginTop: spacing.md }}>
          <Row
            icon="straighten"
            label="Estimated Area"
            value={`${scanResult.estimated_area} m²`}
            colors={colors}
            spacing={spacing}
          />
          <Row
            icon="category"
            label="Room Size"
            value={ROOM_SIZE_LABELS[scanResult.room_size] || scanResult.room_size}
            colors={colors}
            spacing={spacing}
          />
          <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.xs }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="layers" size={20} color={colors.onSurfaceVariant} />
              <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginLeft: spacing.sm }}>
                Clutter Level
              </AppText>
            </View>
            <View style={[styles.clutterBadge, { backgroundColor: clutterColor + '20' }]}>
              <AppText variant="bodySmall" style={{ color: clutterColor, fontWeight: '700' }}>
                {CLUTTER_LABELS[scanResult.clutter_level] || scanResult.clutter_level}
              </AppText>
            </View>
          </View>
          <Row
            icon="tune"
            label="Price Modifier"
            value={`x${scanResult.price_modifier}`}
            colors={colors}
            spacing={spacing}
          />
          <ConfidenceBar value={scanResult.confidence} />
        </AppCard>

        {/* Analysis mode */}
        <AppCard elevation={0} style={{ backgroundColor: colors.surfaceVariant, marginTop: spacing.sm }}>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {scanResult.analysis_mode === 'dimensions'
              ? 'Analysed from your measurements — high accuracy.'
              : `Photo estimate (~${Math.round((scanResult.confidence || 0.4) * 100)}% confidence). If the area looks wrong, tap Adjust below.`}
          </AppText>
        </AppCard>

        {/* Adjust with manual dimensions (shown when photo estimate is low confidence) */}
        {isPhotoEstimate && (
          <>
            <AppButton
              title={showManual ? 'Hide Adjustment' : 'Adjust Estimate'}
              variant="outlined"
              onPress={() => setShowManual(v => !v)}
              style={{ marginTop: spacing.md }}
            />
            {showManual && (
              <AppCard style={{ marginTop: spacing.sm }}>
                <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.sm }}>
                  Enter room dimensions for a more accurate estimate:
                </AppText>
                <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>Width (metres)</AppText>
                <TextInput
                  style={[styles.input, { borderColor: colors.outline, color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  value={manualWidth}
                  onChangeText={setManualWidth}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 4.5"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
                <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>Length (metres)</AppText>
                <TextInput
                  style={[styles.input, { borderColor: colors.outline, color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
                  value={manualLength}
                  onChangeText={setManualLength}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 5.0"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
                <AppButton title="Re-analyse with Dimensions" onPress={handleManualSubmit} style={{ marginTop: spacing.xs }} />
              </AppCard>
            )}
          </>
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <AppButton
            title="Retake"
            variant="outlined"
            onPress={handleRetake}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Use Results"
            onPress={handleUseResults}
            style={{ flex: 1 }}
          />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Camera view ──────────────────────────────────────────────────────
  return (
    <View style={[styles.cameraContainer, { backgroundColor: '#000' }]}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <AppText variant="titleMedium" style={{ color: '#fff', fontWeight: '600' }}>
            Scan Room
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        {/* Crosshair overlay */}
        <View style={styles.crosshairContainer}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionBar}>
          <AppText variant="bodySmall" style={{ color: '#fff', textAlign: 'center' }}>
            Point your camera at the room. Try to capture walls, floor, and furniture.
          </AppText>
        </View>

        {/* Error banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.errorContainer }]}>
            <AppText variant="bodySmall" style={{ color: colors.onErrorContainer }}>
              {error}
            </AppText>
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {/* Manual entry */}
          <Pressable onPress={() => setShowManual(true)} style={styles.sideButton}>
            <MaterialIcons name="straighten" size={28} color="#fff" />
            <AppText variant="bodySmall" style={{ color: '#fff', marginTop: 2 }}>Manual</AppText>
          </Pressable>

          {/* Capture button */}
          <Pressable
            onPress={handleCapture}
            disabled={scanning}
            style={[styles.captureButton, scanning && { opacity: 0.5 }]}
          >
            {scanning ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>

          {/* LiDAR coming soon (blurred) */}
          <Pressable
            onPress={() => Alert.alert('Coming Soon', 'LiDAR scanning will be available in a future update for supported devices.')}
            style={[styles.sideButton, { opacity: 0.4 }]}
          >
            <MaterialCommunityIcons name="cube-scan" size={28} color="#fff" />
            <AppText variant="bodySmall" style={{ color: '#fff', marginTop: 2 }}>LiDAR</AppText>
          </Pressable>
        </View>
      </CameraView>

      {renderManualModal()}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row helper
// ---------------------------------------------------------------------------
function Row({ icon, label, value, colors, spacing }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name={icon} size={20} color={colors.onSurfaceVariant} />
        <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginLeft: spacing.sm }}>
          {label}
        </AppText>
      </View>
      <AppText variant="bodyMedium" style={{ color: colors.onSurface, fontWeight: '600' }}>
        {value}
      </AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Crosshair
  crosshairContainer: {
    flex: 1,
    margin: 40,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  // Instructions
  instructionBar: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  // Error
  errorBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    borderRadius: 8,
    padding: 12,
  },

  // Bottom
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
  },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },

  // Results
  resultsHero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    borderRadius: 16,
  },
  clutterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // Progress bar
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
  },
});
