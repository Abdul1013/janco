import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import AppText from './AppText';

const TABS = [
  { name: 'Home',    icon: 'dashboard',          family: 'M', screen: 'MainTabs', tab: 'HomeScreen' },
  { name: 'Book',    icon: 'cleaning-services',  family: 'M', screen: 'MainTabs', tab: 'Clean' },
  { name: 'Profile', icon: 'user',               family: 'FA', screen: 'MainTabs', tab: 'Profile' },
];

export default function BottomNavBar({ activeTab }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.name;
        const color = active ? colors.primary : colors.onSurfaceVariant;
        const Icon = tab.family === 'FA' ? FontAwesome : MaterialIcons;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.screen, { screen: tab.tab })}
            accessibilityRole="button"
            accessibilityLabel={tab.name}
          >
            {active && <View style={[styles.pill, { backgroundColor: colors.primaryContainer }]} />}
            <Icon name={tab.icon} size={24} color={color} />
            <AppText variant="bodySmall" style={{ color, marginTop: 3, fontWeight: active ? '700' : '400' }}>
              {tab.name}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 2,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 4,
    width: 56,
    height: 30,
    borderRadius: 15,
  },
});
