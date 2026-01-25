import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../hooks/authContext";
import { useNavigation } from "@react-navigation/native";

export default function SplashScreen() {
  const { user, loading } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigation.replace('MainTabs');
      } else {
        navigation.replace('Login');
      }
    }
  }, [loading, user]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  )
}