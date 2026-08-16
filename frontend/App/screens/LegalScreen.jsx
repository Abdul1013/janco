/**
 * LegalScreen — renders the Terms & Conditions or Privacy Policy.
 *
 * Fetches the Markdown document from the backend (`/v1/legal/{docType}`) and
 * renders it with a lightweight inline Markdown renderer (no extra deps).
 * Reached from the signup screen's consent links and from settings.
 *
 * Route params:
 *   - docType: 'terms' | 'privacy'
 *
 * @module screens/LegalScreen
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../constants/theme/ThemeContext';
import { getLegalDoc } from '../../api/legalApi';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppText from '../components/ui/AppText';

const TITLES = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
};

/** Render a single line of text, honouring inline **bold** segments. */
function InlineText({ text, variant, color, style }) {
  const parts = text.split('**');
  return (
    <AppText variant={variant} color={color} style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <AppText key={i} variant={variant} color={color} style={{ fontWeight: '700' }}>
            {part}
          </AppText>
        ) : (
          part
        )
      )}
    </AppText>
  );
}

/** Minimal Markdown → RN renderer covering the subset used in our legal docs. */
function Markdown({ content }) {
  const { colors, spacing } = useTheme();
  const lines = content.split('\n');
  const out = [];

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `l${idx}`;

    if (!line.trim()) {
      out.push(<View key={key} style={{ height: spacing.xs }} />);
    } else if (line.startsWith('### ')) {
      out.push(
        <InlineText key={key} text={line.slice(4)} variant="titleMedium"
          color={colors.onBackground} style={{ marginTop: spacing.sm, marginBottom: spacing.xs }} />
      );
    } else if (line.startsWith('## ')) {
      out.push(
        <InlineText key={key} text={line.slice(3)} variant="titleLarge"
          color={colors.onBackground} style={{ marginTop: spacing.md, marginBottom: spacing.xs }} />
      );
    } else if (line.startsWith('# ')) {
      out.push(
        <InlineText key={key} text={line.slice(2)} variant="headlineMedium"
          color={colors.onBackground} style={{ marginBottom: spacing.sm }} />
      );
    } else if (line.startsWith('---')) {
      out.push(
        <View key={key} style={{ height: 1, backgroundColor: colors.outlineVariant ?? colors.outline, marginVertical: spacing.sm }} />
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      out.push(
        <View key={key} style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: spacing.xs }}>
          <AppText variant="bodyMedium" color={colors.onSurfaceVariant} style={{ marginRight: 6 }}>•</AppText>
          <View style={{ flex: 1 }}>
            <InlineText text={line.slice(2)} variant="bodyMedium" color={colors.onSurfaceVariant} />
          </View>
        </View>
      );
    } else if (line.startsWith('|')) {
      // Render table rows as plain mono-ish lines; skip separator rows (|---|).
      if (/^\|[\s|:-]+\|?$/.test(line)) return;
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      out.push(
        <InlineText key={key} text={cells.join('  ·  ')} variant="bodySmall"
          color={colors.onSurfaceVariant} style={{ marginBottom: 4 }} />
      );
    } else {
      out.push(
        <InlineText key={key} text={line} variant="bodyMedium"
          color={colors.onSurfaceVariant} style={{ marginBottom: spacing.xs, lineHeight: 21 }} />
      );
    }
  });

  return <View>{out}</View>;
}

export default function LegalScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, spacing } = useTheme();
  const docType = route.params?.docType === 'privacy' ? 'privacy' : 'terms';

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigation.setOptions?.({ title: TITLES[docType] });
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await getLegalDoc(docType);
      if (!active) return;
      if (err) setError(err);
      else setContent(data?.content_md ?? '');
      setLoading(false);
    })();
    return () => { active = false; };
  }, [docType, navigation]);

  return (
    <ScreenWrapper>
      <View style={{ padding: spacing.md }}>
        {loading ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <AppText variant="bodyMedium" color={colors.error}>
            Could not load the document. Please check your connection and try again.
          </AppText>
        ) : (
          <Markdown content={content} />
        )}
      </View>
    </ScreenWrapper>
  );
}
