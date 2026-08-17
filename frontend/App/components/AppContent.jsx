// AppContent.js
import { useEffect } from "react";
import useAuthStore from "../store/authStore";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";

import RootNavigator, { linking } from "../navigation/RootNavigator";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../constants/theme/ThemeContext";

SplashScreen.preventAutoHideAsync();

export default function AppContent() {
  const initialized = useAuthStore((s) => s.initialized);
  const { isDark, colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Chewy: require("../../assets/fonts/Chewy-Regular.ttf"),
    Quicksand: require("../../assets/fonts/Quicksand-Regular.ttf"),
    QuicksandMedium: require("../../assets/fonts/Quicksand-Medium.ttf"),
    QuicksandBold: require("../../assets/fonts/Quicksand-Bold.ttf"),
  });

  useEffect(() => {
    const hide = async () => {
      if (fontsLoaded && initialized) {
        await SplashScreen.hideAsync();
      }
    };
    hide();
  }, [fontsLoaded, initialized]);

  if (!fontsLoaded || !initialized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.surface} />
      <NavigationContainer linking={linking}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <RootNavigator />
        </SafeAreaView>
      </NavigationContainer>
    </>
  );
}
