// app/_layout.tsx (or wherever RootLayout is defined)
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from './hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    Chewy: require('./assets/fonts/Chewy-Regular.ttf'),
    Quicksand: require('./assets/fonts/Quicksand-Regular.ttf'),
    QuicksandMedium: require('./assets/fonts/Quicksand-Medium.ttf'),
    QuicksandBold: require('./assets/fonts/Quicksand-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null; // Or return a loading spinner
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
