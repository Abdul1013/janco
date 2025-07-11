// // This is a shim for web and Android where the tab bar is generally opaque.
// export default undefined;

// export function useBottomTabOverflow() {
//   return 0;
// }
// // 
// components/ui/TabBarBackground.jsx
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return <BlurView tint="default" intensity={100} style={StyleSheet.absoluteFill} />;
  }

  return <View style={styles.fallback} />;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: 'white',
    flex: 1,
  },
});