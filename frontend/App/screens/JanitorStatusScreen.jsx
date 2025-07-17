import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Button,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/authContext";
import { useNavigation } from "@react-navigation/native";
import { Typography } from "../components/theme/Theme";
import Header from "../components/Header";
import { SafeAreaView } from "react-native-safe-area-context";

export default function JanitorStatusScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("pending");

  const checkApprovalStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from("janitors")
        .select("status")
        .eq("janitor_id", user.id)
        .single();

      if (error) throw error;

      setStatus(data.status);

      if (data.status === "approved") {
        Alert.alert(
          "🎉 You’re now a Janitor!",
          "Redirecting to your dashboard..."
        );
        navigation.replace("JanitorDashboard");
      } else{
        Alert.alert('Review still in Progress')
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not check status.");
    } finally {
      setChecking(false);
    }
  };

  // useEffect(() => {
  //   const interval = setInterval(checkApprovalStatus, 100000); // check every 10s
  //   return () => clearInterval(interval); // cleanup
  // }, []);

  return (
    <SafeAreaView style={Typography.container}>
      <Header title="Application Status" />
      <View style={{ flex:1 ,alignItems: "center", justifyContent: "center" }}>
        <Text style={Typography.subtitle}>Application Received!</Text>
        <Image
          source={require("../../assets/approval.png")} // optional image
          style={styles.image}
          resizeMode="contain"
        />

        
        <Text style={Typography.note}>
          🕐 Your request to become a janitor is being reviewed.
          You will be notified once approved.
        </Text>

        {checking ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <Button
            title="Check Now"
            onPress={checkApprovalStatus}
            color="#007bff"
          />
        )}
        <Button
          title="Back to Home"
          onPress={() => navigation.navigate("MainTabs")}
          color="#777"
          style={{ marginTop: 10 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 180,
    height: 180,
    marginVertical: 30,
    borderRadius: 100,
  },


  
});
