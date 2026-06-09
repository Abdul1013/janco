/**
 * RatingScreen — Sprint 4 Day 23.
 *
 * Shown automatically after a job is completed. Allows the customer
 * to submit a 1–5 star rating with an optional comment.
 *
 * Uses ratingApi.submitRating() — zero direct Supabase calls.
 *
 * @module screens/RatingScreen
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../constants/theme/ThemeContext';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import AppCard from '../components/ui/AppCard';
import * as ratingApi from '../api/ratingApi';

export default function RatingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, spacing, typography } = useTheme();

  const { jobId, janitorName = 'your janitor', serviceType = '' } = route.params || {};

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const starLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  const handleSubmit = async () => {
    if (score === 0) {
      setError('Please select a rating.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: apiError } = await ratingApi.submitRating(jobId, score, comment.trim());
    setLoading(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    setSubmitted(true);
  };

  const handleSkip = () => {
    navigation.navigate('Home');
  };


  // Success state

  if (submitted) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <MaterialIcons name="star" size={72} color={colors.primary} />
          <AppText
            variant="headlineSmall"
            style={{ color: colors.onBackground, marginTop: spacing.md, textAlign: 'center' }}
          >
            Thank You!
          </AppText>
          <AppText
            variant="bodyMedium"
            style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm, textAlign: 'center' }}
          >
            Your rating helps improve service quality on JANCO.
          </AppText>
          <View style={{ marginTop: spacing.xl, width: '100%' }}>
            <AppButton title="Back to Home" onPress={() => navigation.navigate('MainTabs')} />
          </View>
        </View>
      </ScreenWrapper>
    );
  }


  // Rating form

  return (
    <ScreenWrapper avoidKeyboard>
      <View style={{ flex: 1, padding: spacing.md }}>
        <AppText variant="headlineSmall" style={{ color: colors.onBackground, marginBottom: spacing.xs }}>
          Rate Your Experience
        </AppText>
        <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.lg }}>
          How was {janitorName}'s {serviceType.replace(/_/g, ' ')} service?
        </AppText>

        {/* Star selector */}
        <AppCard style={{ padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => { setScore(star); setError(null); }}
                activeOpacity={0.7}
                style={{ padding: spacing.xs }}
                accessibilityRole="button"
                accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
              >
                <MaterialIcons
                  name={star <= score ? 'star' : 'star-border'}
                  size={44}
                  color={star <= score ? colors.primary : colors.outlineVariant}
                />
              </TouchableOpacity>
            ))}
          </View>
          {score > 0 && (
            <AppText
              variant="titleMedium"
              style={{ color: colors.primary, marginTop: spacing.sm }}
            >
              {starLabels[score]}
            </AppText>
          )}
        </AppCard>

        {/* Comment input */}
        <AppCard style={{ padding: spacing.md, marginBottom: spacing.md }}>
          <AppText variant="titleSmall" style={{ color: colors.onSurface, marginBottom: spacing.sm }}>
            Leave a comment (optional)
          </AppText>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Share details about your experience..."
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            numberOfLines={4}
            maxLength={500}
            style={{
              ...typography.bodyMedium,
              color: colors.onSurface,
              backgroundColor: colors.surfaceVariant,
              borderRadius: 8,
              padding: spacing.sm,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
          <AppText
            variant="labelSmall"
            style={{ color: colors.onSurfaceVariant, textAlign: 'right', marginTop: spacing.xs }}
          >
            {comment.length}/500
          </AppText>
        </AppCard>

        {error ? (
          <AppText variant="bodySmall" style={{ color: colors.error, marginBottom: spacing.sm }}>
            {error}
          </AppText>
        ) : null}

        <AppButton title="Submit Rating" onPress={handleSubmit} loading={loading} />

        <TouchableOpacity
          onPress={handleSkip}
          style={{ alignItems: 'center', marginTop: spacing.md, padding: spacing.sm }}
          accessibilityRole="button"
        >
          <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            Skip for now
          </AppText>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}
