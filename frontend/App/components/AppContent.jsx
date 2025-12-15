// AppContent.js
import React, { useEffect } from "react";
import { useAuth } from "../hooks/authContext";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import * as Linking from "expo-linking";

import RootNavigator from "../navigation/RootNavigator";
import AuthNavigator from "../navigation/AuthNavigator";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

SplashScreen.preventAutoHideAsync();

const linking = {
  prefixes: ["janco://"],
  config: {
    screens: {
      AuthCallback: "auth/callback",
      Home: "home",
      UpdatePassword: "reset-password",
    },
  },
};

export default function AppContent() {
  const { user, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    Chewy: require("../../assets/fonts/Chewy-Regular.ttf"),
    Quicksand: require("../../assets/fonts/Quicksand-Regular.ttf"),
    QuicksandMedium: require("../../assets/fonts/Quicksand-Medium.ttf"),
    QuicksandBold: require("../../assets/fonts/Quicksand-Bold.ttf"),
  });

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar hidden/>
        {user ? <RootNavigator /> : <AuthNavigator />}
      </SafeAreaView>
    </NavigationContainer>
  );
}
