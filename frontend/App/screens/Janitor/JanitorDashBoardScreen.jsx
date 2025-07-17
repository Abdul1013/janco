import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  FlatList,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/authContext";
import { useJanitorProfile } from "../../hooks/useJanitors";
import { Colors, Spacing, Typography } from "../../components/theme/Theme";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../components/Header";
import { MaterialIcons } from "@expo/vector-icons";

const box = [
  {
    title: "History",
    icon: <MaterialIcons name="history" size={28} color={Colors.dark.cardBorder}/>,
    body: "View Job History",
    onPress: "History",
  },
  {
    title: "Earnings",
    icon: <MaterialIcons name="account-balance-wallet" size={28} color={Colors.dark.cardBorder}/>,
    body: "This Month: ₦0.00",
    onPress: "Earnings",
  },
  {
    title: "Messages",
    icon: <MaterialIcons name="message" size={28}color={Colors.dark.cardBorder} />,
    body: "Open Jobs Chat",
    onPress: "Chat",
  },
  {
    title: "Ratings",
    icon: <MaterialIcons name="star" size={28} color={Colors.dark.cardBorder} />,
    body: "Your Average Rating is: 4.1",
    onPress: "Ratings",
  },
];

export default function JanitorDashBoardScreen({ navigation }) {
  const { user } = useAuth();
  const {
    jobs,
    availability,
    updateAvailability,
    completeJob,
    reviews,
    jobHistory,
    earnings,
  } = useJanitorProfile();

  const handleComplete = async (id) => {
    await completeJob(id);
    Alert.alert("Job marked as complete");
  };

  return (
    <SafeAreaView style={Typography.container}>
      <Header title="🧹 Janitor Dashboard" />

      <View style={styles.switchRow}>
        <Text style={Typography.subtitle}>Available for Jobs:</Text>
        <Switch value={availability} onValueChange={updateAvailability} />
      </View>

      <Text style={Typography.subtitle}>Upcoming Jobs</Text>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.jobCard}>
            <Text style={styles.jobText}>🧾 {item.service_type}</Text>
            <Text>Date: {new Date(item.scheduled_date).toLocaleDateString()}</Text>
            <Text>Location: {item.location}</Text>
            <Text>Status: {item.status}</Text>
            {item.status !== "completed" && (
              <Button
                title="Mark Complete"
                onPress={() => handleComplete(item.id)}
              />
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={[Typography.link, {textAlign:'center'}]}>No jobs assigned yet.</Text>}
      />

      <Text style={Typography.subtitle}>Quick Access</Text>
      <View style={styles.grid}>
        {box.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.box}
            onPress={() => navigation.navigate(item.onPress)}
          >
            {item.icon}
            <Text style={Typography.defaultSemiBold}>{item.title}</Text>
            <Text style={Typography.note}>{item.body}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
    paddingBottom: Spacing.xxs,
    borderBottomWidth: 0.5,
    borderColor: Colors.dark.border
  },
  label: { fontSize: 16 },
  subHeader: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 16,
  },
  jobCard: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  jobText: { fontWeight: "bold", marginBottom: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    // gap: 16,
    paddingTop: Spacing.xxs,
  },
  box: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.dark.accent,
    marginBottom: Spacing.sm,
  },
  boxTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  boxBody: {
    fontSize: 12,
    color: "#f2f2f2",
    textAlign: "center",
    marginTop: 4,
  },
});
