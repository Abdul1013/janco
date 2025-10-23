import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../hooks/authContext";
import Header from "../components/Header";
import Button from "../components/ui/Button";
import { Typography, Colors } from "../components/theme/Theme";

const API_BASE = process.env.API_URL || "https://api.yourdomain.com"; // set your API base in env

export default function NearbyJanitors() {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile, user } = useAuth();

  // booking data passed from PriceEstimateScreen
  const {
    category,
    rooms,
    toilets,
    clothesCount,
    extras,
    date,
    time,
    notes,
    address,
    userLocation,
    priceEstimate,
    breakdown,
  } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [janitors, setJanitors] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    loadNearbyJanitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNearbyJanitors() {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        service: category,
        user_lat: String(userLocation?.lat || 0),
        user_lng: String(userLocation?.lng || 0),
        max_km: "10",
      });

      const res = await fetch(`${API_BASE}/nearby-janitors?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // include auth if available
          ...(profile?.accessToken ? { Authorization: `Bearer ${profile.accessToken}` } : {}),
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to fetch janitors");
      }

      const json = await res.json();
      setJanitors(json.janitors || []);
    } catch (err) {
      console.warn("Nearby janitors fetch error", err);
      setFetchError(err.message || "Failed to fetch nearby janitors");
    } finally {
      setLoading(false);
    }
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Text style={Typography.note}>No available janitors found in your area.</Text>
        <Button title="Retry" onPress={loadNearbyJanitors} />
      </View>
    );
  }

  function onChooseJanitor(janitor) {
    Alert.alert(
      "Confirm selection",
      `You selected ${janitor.name} (${janitor.distance_km ?? "n/a"} km away). Proceed to book?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => handleBookWithJanitor(janitor) },
      ]
    );
  }

  async function handleBookWithJanitor(janitor) {
    // Build booking payload expected by /book-job
    const payload = {
      user_id: profile?.id || user?.id || null,
      janitor_id: janitor.id,
      service_type: category,
      scheduled_time: `${date} ${time}`,
      location: {
        city: address?.city || address || "Unknown",
        lat: userLocation?.lat || 0,
        lng: userLocation?.lng || 0,
        address_line: address || "",
      },
      // include client-side breakdown/notes for admin
      metadata: {
        priceEstimate,
        breakdown,
        notes,
        rooms,
        toilets,
        clothesCount,
        extras,
      },
    };

    setBookingInProgress(true);
    try {
      const res = await fetch(`${API_BASE}/book-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(profile?.accessToken ? { Authorization: `Bearer ${profile.accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Booking failed");
      }

      const json = await res.json();

      // navigate to JobStatus or JobDetails with returned job
      Alert.alert("Success", "Job successfully created", [
        {
          text: "OK",
          onPress: () => navigation.navigate("JobStatus", { job: json.job || json }),
        },
      ]);
    } catch (err) {
      console.warn("Booking error", err);
      Alert.alert("Booking failed", err.message || "Please try again");
    } finally {
      setBookingInProgress(false);
    }
  }

  function renderItem({ item }) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Image
            source={{ uri: item.avatar || "https://placehold.co/80x80" }}
            style={styles.avatar}
          />
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={styles.name}>{item.name || "Unnamed Janitor"}</Text>
            <Text style={styles.sub}>{item.bio || item.about || "Available janitor"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>{item.distance_km ?? "—"} km</Text>
              {item.rating ? <Text style={styles.muted}> • {item.rating}★</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.priceNote}>Available now</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => onChooseJanitor(item)} disabled={bookingInProgress}>
            <Text style={styles.selectText}>{bookingInProgress ? "Booking..." : "Select"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <Header title="Choose Janitor" />
      <View style={{ padding: 16 }}>
        <Text style={Typography.header}>Nearby Janitors</Text>
        <Text style={Typography.note}>Choose a janitor to assign for this booking</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : fetchError ? (
        <View style={{ padding: 16 }}>
          <Text style={Typography.note}>Error: {fetchError}</Text>
          <Button title="Retry" onPress={loadNearbyJanitors} />
        </View>
      ) : (
        <FlatList
          data={janitors}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f8f8f8" },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#eee" },
  name: { fontSize: 16, fontWeight: "700" },
  sub: { color: "#666", marginTop: 4 },
  metaRow: { flexDirection: "row", marginTop: 6 },
  muted: { color: "#888", fontSize: 13 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  selectBtn: {
    backgroundColor: Colors.primary || "#00A86B",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectText: { color: "#fff", fontWeight: "700" },
  priceNote: { color: "#333" },
  empty: { padding: 24, alignItems: "center" },
});

// Example: Booking Flow
// User lands on the screen.
// App fetches nearby janitors.
// User taps "Select" on a janitor.
// Confirmation dialog appears.
// On confirm, booking request is sent.
// On success, navigates to job status.
// Suggestions
// Error Handling: Consider more user-friendly error messages.
// Location Defaults: Warn users if location is missing.
// Accessibility: Add accessibility labels to buttons and images.
