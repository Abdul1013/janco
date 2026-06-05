import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import AppText from './AppText';
import { TypeScale } from '../../constants/theme';

export default function AppHeader({ title, onBack, showBack = true, rightElement }) {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.outlineVariant }]}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <AppText
        variant="headlineSmall"
        style={[{  color: colors.primary, flex: 1, textAlign: 'center', fontWeight: '600' }, TypeScale.displaySmall]}
        numberOfLines={1}
      >
        {title}
      </AppText>

      <View style={styles.side}>
        {rightElement ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  side: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
