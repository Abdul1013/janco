import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';

import { useAuth } from './hooks/useAuth';
import RootNavigator from './navigation/RootNavigator';
import AuthNavigator from './navigation/AuthNavigator';

SplashScreen.preventAutoHideAsync(); // ⚠️ must be outside the component

const linking = {
  prefixes: ['janco://'],
  config: {
    screens: {
      AuthCallback: 'auth/callback',
      Home: 'home',
      UpdatePassword: 'reset-password',
    },
  },
};

export default function App() {
  const { user, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    Chewy: require('./assets/fonts/Chewy-Regular.ttf'),
    Quicksand: require('./assets/fonts/Quicksand-Regular.ttf'),
    QuicksandMedium: require('./assets/fonts/Quicksand-Medium.ttf'),
    QuicksandBold: require('./assets/fonts/Quicksand-Bold.ttf'),
  });

  // ✅ This ensures splash hides after both fonts & auth are ready
  useEffect(() => {
    const hide = async () => {
      if (fontsLoaded && !loading) {
        await SplashScreen.hideAsync();
      }
    };
    hide();
  }, [fontsLoaded, loading]);

  if (!fontsLoaded || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {user ? <RootNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
