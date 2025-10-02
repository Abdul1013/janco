// screens/JobStatus.js
import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../components/Header";
import { Typography, Colors } from "../components/theme/Theme";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../hooks/authContext";

const API_BASE = process.env.API_URL || "https://api.yourdomain.com";

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = v => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function JobStatus() {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile } = useAuth();
  const initialJob = route.params?.job || null;

  const [job, setJob] = useState(initialJob);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef(null);

  useEffect(() => {
    // start polling
    startPolling();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling() {
    fetchJob();
    pollingRef.current = setInterval(fetchJob, 15000);
  }
  function stopPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
  }

  async function fetchJob() {
    if (!job?.id) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/${job.id}`, {
        headers: {
          "Content-Type": "application/json",
          ...(profile?.accessToken ? { Authorization: `Bearer ${profile.accessToken}` } : {}),
        },
      });
      if (!res.ok) {
        console.warn("Could not fetch job");
        return;
      }
      const json = await res.json();
      setJob(json.job || json);
    } catch (err) {
      console.warn("fetchJob error", err);
    }
  }

  function computeETAMinutes() {
    if (!job?.janitor || !job.location || !job.janitor.lat || !job.janitor.lng) return null;
    const distKm = haversineKm(job.location.lat, job.location.lng, job.janitor.lat, job.janitor.lng);
    const avgSpeedKmph = 30; // assumption
    return Math.max(2, Math.round((distKm / avgSpeedKmph) * 60)); // at least 2 minutes
  }

  async function cancelJob() {
    if (!job?.id) return;
    Alert.alert("Cancel Job", "Are you sure you want to cancel this job?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        onPress: async () => {
          setLoading(true);
          try {
            const res = await fetch(`${API_BASE}/cancel-job`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(profile?.accessToken ? { Authorization: `Bearer ${profile.accessToken}` } : {}),
              },
              body: JSON.stringify({ job_id: job.id }),
            });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            setJob(json.job || { ...job, status: "cancelled" });
            Alert.alert("Cancelled", "Job cancelled successfully");
            stopPolling();
            navigation.navigate("Home");
          } catch (err) {
            console.warn("cancel error", err);
            Alert.alert("Failed", err.message || "Could not cancel");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.wrap}>
        <Header title="Job" />
        <View style={{ padding: 20 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 12 }}>Loading job...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const eta = computeETAMinutes();
  const janitor = job.janitor || job.assigned_janitor || {};

  return (
    <SafeAreaView style={styles.wrap}>
      <Header title="Job Status" />
      <View style={{ padding: 16 }}>
        <Text style={Typography.header}>Status: {job.status || "unknown"}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Janitor</Text>
          <Text style={styles.name}>{janitor.name || "—"}</Text>
          <Text style={styles.sub}>{janitor.bio || janitor.about || "Professional cleaner"}</Text>

          <View style={{ flexDirection: "row", marginTop: 8, justifyContent: "space-between" }}>
            <Text style={styles.muted}>Rating: {janitor.rating ?? "—"}</Text>
            <Text style={styles.muted}>ETA: {eta ? `${eta} min` : "—"}</Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Scheduled: {job.scheduled_time || job.scheduled_date || "—"}</Text>
            <Text style={styles.label}>Address: {job.location?.address_line || job.location?.city || "—"}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Notes: {job.metadata?.notes || job.notes || "—"}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Chat", { janitorId: janitor.id, jobId: job.id })}>
            <Text style={styles.actionText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#ff6b6b" }]} onPress={cancelJob} disabled={loading}>
            <Text style={styles.actionText}>{loading ? "Cancelling..." : "Cancel Job"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff" },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 10, elevation: 2, marginTop: 12 },
  label: { fontSize: 14, color: "#444", marginBottom: 6 },
  name: { fontSize: 18, fontWeight: "700" },
  sub: { color: "#666", marginTop: 6 },
  muted: { color: "#777" },
  actionBtn: { backgroundColor: Colors.primary || "#00A86B", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginTop: 14 },
  actionText: { color: "#fff", fontWeight: "700" },
});
