/**
 * VerificationScreen — Sprint 4 Day 22.
 *
 * Three-step janitor identity verification flow:
 *   Step 1: Enter NIN or BVN number → submit to backend
 *   Step 2: Camera selfie for liveness detection → submit to backend
 *   Step 3: Show result — verified badge or retry prompt
 *
 * Uses verificationApi exclusively — zero direct Supabase calls.
 * Max 3 retries before manual review.
 *
 * @module screens/Janitor/VerificationScreen
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Alert, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../constants/theme/ThemeContext";
import ScreenWrapper from "../../components/ui/ScreenWrapper";
import AppText from "../../components/ui/AppText";
import AppInput from "../../components/ui/AppInput";
import AppButton from "../../components/ui/AppButton";
import AppCard from "../../components/ui/AppCard";
import * as verificationApi from "../../../api/verificationApi";
import AppHeader from "../../components/ui/AppHeader";

const STEPS = [
  { key: "id_check", label: "ID Verification", icon: "badge" },
  { key: "liveness", label: "Liveness Check", icon: "face" },
  { key: "result", label: "Result", icon: "verified" },
];

export default function VerificationScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [idType, setIdType] = useState("nin");
  const [idNumber, setIdNumber] = useState("");
  const [selfieUri, setSelfieUri] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [retriesLeft, setRetriesLeft] = useState(3);
  const [error, setError] = useState(null);

  // Check existing status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    const { data, error: apiError } =
      await verificationApi.getVerificationStatus();
    setLoading(false);

    if (data) {
      setVerificationStatus(data.status);
      setRetriesLeft(data.retries_left ?? 3);

      // Route to the appropriate step based on status
      if (data.status === "verified") {
        setStep(2);
      } else if (data.status === "id_verified") {
        setStep(1);
      }
    }
  };

  // Step 1 — Submit NIN/BVN
  const handleIdSubmit = async () => {
    if (!idNumber.trim()) {
      setError("Please enter your ID number.");
      return;
    }
    if (idNumber.trim().length < 10) {
      setError("ID number must be at least 10 digits.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: apiError } =
      await verificationApi.initiateVerification(idType, idNumber.trim());

    setLoading(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    setVerificationStatus("id_verified");
    setStep(1);
  };

  // Step 2 — Liveness selfie
  const handleLivenessSubmit = async () => {
    setLoading(true);
    setError(null);

    // For beta: use a mock base64 string since camera integration
    // requires native module setup (expo-camera)
    let imageBase64 = "mock_selfie_base64";

    if (selfieUri) {
      // In production: read file as base64
      // const base64 = await FileSystem.readAsStringAsync(selfieUri, { encoding: 'base64' });
      imageBase64 = "captured_selfie_base64";
    }

    const { data, error: apiError } =
      await verificationApi.submitLiveness(imageBase64);
    setLoading(false);

    if (apiError) {
      setError(apiError);
      const { data: statusData } =
        await verificationApi.getVerificationStatus();
      if (statusData) setRetriesLeft(statusData.retries_left ?? 0);
      return;
    }

    setVerificationStatus("verified");
    setStep(2);
  };

  // Camera placeholder (expo-camera would be integrated here)
  const handleTakeSelfie = () => {
    // In production: launch expo-camera
    // For beta: simulate capture
    setSelfieUri("mock://selfie.jpg");
    Alert.alert(
      "Selfie Captured",
      "Your selfie has been captured for verification.",
    );
  };

  // Step Indicator

  const renderStepIndicator = () => (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}
    >
      {STEPS.map((s, idx) => {
        const isActive = idx === step;
        const isComplete = idx < step;
        const circleColor = isComplete
          ? colors.primary
          : isActive
            ? colors.primary
            : colors.surfaceVariant;
        const iconColor =
          isComplete || isActive ? colors.onPrimary : colors.onSurfaceVariant;

        return (
          <View key={s.key} style={{ alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: circleColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isComplete ? (
                <MaterialIcons name="check" size={20} color={iconColor} />
              ) : (
                <MaterialIcons name={s.icon} size={20} color={iconColor} />
              )}
            </View>
            <AppText
              variant="labelSmall"
              style={{
                color:
                  isActive || isComplete
                    ? colors.primary
                    : colors.onSurfaceVariant,
                marginTop: spacing.xs,
                textAlign: "center",
              }}
            >
              {s.label}
            </AppText>
            {idx < STEPS.length - 1 && (
              <View
                style={{
                  position: "absolute",
                  top: 20,
                  left: "70%",
                  right: "-30%",
                  height: 2,
                  backgroundColor: isComplete
                    ? colors.primary
                    : colors.outlineVariant,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );

  // Step 1 — ID Verification

  const renderIdStep = () => (
    <AppCard style={{ padding: spacing.md }}>
      <AppText
        variant="titleMedium"
        style={{ color: colors.onSurface, marginBottom: spacing.sm }}
      >
        Identity Verification
      </AppText>
      <AppText
        variant="bodyMedium"
        style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md }}
      >
        Enter your NIN or BVN to verify your identity. Your ID number is never
        stored — only the verification reference is kept.
      </AppText>

      {/* ID Type Selector */}
      <View
        style={{
          flexDirection: "row",
          marginBottom: spacing.md,
          gap: spacing.sm,
        }}
      >
        <AppButton
          title="NIN"
          variant={idType === "nin" ? "filled" : "outlined"}
          onPress={() => setIdType("nin")}
          style={{ flex: 1 }}
        />
        <AppButton
          title="BVN"
          variant={idType === "bvn" ? "filled" : "outlined"}
          onPress={() => setIdType("bvn")}
          style={{ flex: 1 }}
        />
      </View>

      <AppInput
        label={idType === "nin" ? "NIN Number" : "BVN Number"}
        value={idNumber}
        onChangeText={setIdNumber}
        error={error}
        inputProps={{
          placeholder: `Enter your ${idType.toUpperCase()} number`,
          keyboardType: "numeric",
          maxLength: 11,
        }}
      />

      <AppText
        variant="bodySmall"
        style={{
          color: colors.onSurfaceVariant,
          marginTop: spacing.xs,
          marginBottom: spacing.md,
        }}
      >
        Retries remaining: {retriesLeft}
      </AppText>

      <AppButton
        title="Verify ID"
        onPress={handleIdSubmit}
        loading={loading}
        disabled={retriesLeft <= 0}
      />
    </AppCard>
  );

  // Step 2 — Liveness Check

  const renderLivenessStep = () => (
    <AppCard style={{ padding: spacing.md }}>
      <AppText
        variant="titleMedium"
        style={{ color: colors.onSurface, marginBottom: spacing.sm }}
      >
        Liveness Check
      </AppText>
      <AppText
        variant="bodyMedium"
        style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md }}
      >
        Take a clear selfie to confirm your identity matches your ID. Ensure
        good lighting and face the camera directly.
      </AppText>

      {/* Selfie preview or camera trigger */}
      <View
        style={{
          height: 200,
          backgroundColor: colors.surfaceVariant,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.md,
        }}
      >
        {selfieUri ? (
          <View style={{ alignItems: "center" }}>
            <MaterialIcons
              name="check-circle"
              size={48}
              color={colors.primary}
            />
            <AppText
              variant="bodyMedium"
              style={{ color: colors.onSurface, marginTop: spacing.xs }}
            >
              Selfie captured
            </AppText>
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <MaterialIcons
              name="camera-alt"
              size={48}
              color={colors.onSurfaceVariant}
            />
            <AppText
              variant="bodyMedium"
              style={{ color: colors.onSurfaceVariant, marginTop: spacing.xs }}
            >
              No selfie taken yet
            </AppText>
          </View>
        )}
      </View>

      {error ? (
        <AppText
          variant="bodySmall"
          style={{ color: colors.error, marginBottom: spacing.sm }}
        >
          {error}
        </AppText>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppButton
          title={selfieUri ? "Retake Selfie" : "Take Selfie"}
          variant="outlined"
          onPress={handleTakeSelfie}
        />
        <AppButton
          title="Submit for Verification"
          onPress={handleLivenessSubmit}
          loading={loading}
          disabled={!selfieUri}
        />
      </View>
    </AppCard>
  );

  // Step 3 — Result

  const renderResultStep = () => {
    const isVerified = verificationStatus === "verified";

    return (
      <AppCard style={{ padding: spacing.lg, alignItems: "center" }}>
        <MaterialIcons
          name={isVerified ? "verified" : "error-outline"}
          size={64}
          color={isVerified ? colors.primary : colors.error}
        />
        <AppText
          variant="headlineSmall"
          style={{
            color: isVerified ? colors.primary : colors.error,
            marginTop: spacing.md,
            textAlign: "center",
          }}
        >
          {isVerified ? "Verification Complete!" : "Verification Failed"}
        </AppText>
        <AppText
          variant="bodyMedium"
          style={{
            color: colors.onSurfaceVariant,
            marginTop: spacing.sm,
            textAlign: "center",
          }}
        >
          {isVerified
            ? "Your profile now displays a verified badge. This improves your trust score and visibility to customers."
            : "Your verification could not be completed. Please contact support for assistance."}
        </AppText>
        <View style={{ marginTop: spacing.lg, width: "100%" }}>
          <AppButton
            title={isVerified ? "Go to Dashboard" : "Try Again"}
            onPress={() => {
              if (isVerified) {
                navigation.navigate("JanitorDashBoard");
              } else {
                setStep(0);
                setError(null);
              }
            }}
          />
        </View>
      </AppCard>
    );
  };

  // Render

  return (
    <ScreenWrapper avoidKeyboard  showBack title="Identity Verification" padding={0} style={{ flex: 1 }}>
      {renderStepIndicator()}

      {step === 0 && renderIdStep()}
      {step === 1 && renderLivenessStep()}
      {step === 2 && renderResultStep()}
    </ScreenWrapper>
  );
}
