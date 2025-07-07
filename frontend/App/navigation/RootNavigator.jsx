//main stack screen
import React from "react";
import { useAuth } from "../hooks/authContext";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import { ActivityIndicator } from "react-native";
import LoginScreen from "../screens/auth/LoginScreen";
import RegistrationScreen from "../screens/auth/RegistrationScreen";
import JanitorRegistrationScreen from "../screens/JanitorRegistrationScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, profile, loading } = useAuth();

  if (loading) return <ActivityIndicator />;

  if (!user) return <LoginScreen />;
  if (user && !profile?.is_registered) {
    return <RegistrationScreen />;
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Registration" component={RegistrationScreen} />
      <Stack.Screen name="JanitorRegistration" component={JanitorRegistrationScreen} />
    </Stack.Navigator>
  );
}
