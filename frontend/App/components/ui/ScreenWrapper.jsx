import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../constants/theme/ThemeContext';
import { Spacing } from '../../constants/theme';
import AppHeader from './AppHeader';
// import BottomNavBar from './BottomNavBar';

export default function ScreenWrapper({
  children,
  scrollable = true,
  avoidKeyboard = false,
  padding,
  style,
  // header
  title,
  showBack = false,
  onBack,
  headerRight,
  // nav
  showNav = false,
  activeTab,
  // scroll
  refreshControl,
}) {
  const { colors, isDark } = useTheme();

  const showHeader = !!title;

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.background },
    style,
  ];

  const scrollPad = { paddingHorizontal: padding ?? Spacing.base };

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.scroll, scrollPad, showNav && styles.scrollWithNav]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, scrollPad]}>{children}</View>
  );

  const wrapped = avoidKeyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={showHeader ? 56 : 0}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView style={containerStyle} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'dark-content' : 'light-content'} backgroundColor={colors.surface} />
      {showHeader && (
        <AppHeader title={title} showBack={showBack} onBack={onBack} rightElement={headerRight} />
      )}
      {wrapped}
      {/* {showNav && <BottomNavBar activeTab={activeTab} />} */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: Spacing.xxl },
  scrollWithNav: { paddingBottom: 80 },
});
