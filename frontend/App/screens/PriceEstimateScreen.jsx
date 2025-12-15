import React, { useState } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import Header from "../components/Header";
import { Typography } from "../components/theme/Theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Button from "../components/ui/Button";
import { calculatePrice, formatPrice, getServiceLabel } from "../utils/pricing";

export default function PriceEstimateScreen({ route }) {
  const navigation = useNavigation();
  const params = route?.params || {};

  const {
    category,
    rooms = 1,
    toilets = 0,
    clothesCount = 0,
    extras = {},
    date = "",
    time = "",
    notes = "",
    address = "",
    userLocation = { lat: 0, lng: 0 },
  } = params;

  const [useFixedPricing, setUseFixedPricing] = useState(true);

  // Calculate price using centralized utility
  const priceData = calculatePrice(category, {
    rooms: parseInt(rooms || 1, 10),
    toilets: parseInt(toilets || 0, 10),
    clothesCount: parseInt(clothesCount || 0, 10),
    extras: extras || {},
  }, useFixedPricing);

  const { estimate, breakdown, description } = priceData;

  return (
    <SafeAreaView style={Typography.container}>
      <Header title={"Price Estimate"} />
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            paddingHorizontal: 12,
            paddingVertical: 12,
            backgroundColor: "#1a1a1a",
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: "#fff", fontWeight: "500" }}>
            {useFixedPricing ? "Fixed Pricing (MVP)" : "Dynamic Pricing"}
          </Text>
          <Switch 
            value={useFixedPricing} 
            onValueChange={setUseFixedPricing}
            trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
            thumbColor={useFixedPricing ? "#4CAF50" : "#f4f3f4"}
          />
        </View>

        <Text style={Typography.subtitle}>Service Details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Service: {getServiceLabel(category)}</Text>
          <Text style={styles.label}>Date: {date} at {time}</Text>
          <Text style={styles.label}>Address: {address}</Text>
          {notes && <Text style={[styles.label, { color: "#999" }]}>Notes: {notes}</Text>}
        </View>

        <Text style={Typography.subtitle}>Cost Breakdown</Text>
        <View style={styles.card}>
          {breakdown.map((item, idx) => (
            <Text key={idx} style={styles.item}>
              {item}
            </Text>
          ))}
          <View style={{ borderTopColor: "#333", borderTopWidth: 1, marginTop: 12, paddingTop: 12 }}>
            <Text style={styles.total}>Total: {formatPrice(estimate)}</Text>
          </View>
        </View>

        <Button
          title="Continue to Select Janitor"
          variant="primary"
          size="lg"
          onPress={() =>
            navigation.navigate("NearbyJanitors", {
              category,
              rooms: parseInt(rooms || 1, 10),
              toilets: parseInt(toilets || 0, 10),
              clothesCount: parseInt(clothesCount || 0, 10),
              extras,
              date,
              time,
              notes,
              address,
              userLocation,
              priceEstimate: estimate,
              breakdown,
            })
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8f8f8",
    justifyContent: "center",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#262626",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: "#ddd",
    fontWeight: "500",
  },
  item: {
    fontSize: 13,
    marginBottom: 6,
    color: "#bbb",
  },
  total: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  button: {
    backgroundColor: "#00A86B",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
