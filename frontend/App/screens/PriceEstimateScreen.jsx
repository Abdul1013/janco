import { View, Text, StyleSheet,TouchableOpacity } from "react-native";
import React from "react";
import Header from "../components/Header";
import { Typography } from "../components/theme/Theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
export default function PriceEstimateScreen({ route }) {
  const navigation = useNavigation();
  const params = route?.params || {};

  const {
    category,
    rooms = 1,
    toilets = 1,
    clothesCount = 0,
    extras = {},
    date = '',
    time = '',
    notes = '',
    address = '',
    userLocation = { lat: 0, lng: 0 },
  } = params;

  // Simple Pricing Rules
  const rates = {
    house_cleaning: 1500, // per room
    toilet: 800,
    laundry: 300, // per cloth
    fumigation: 10000, // flat
  };

  let estimate = 0;
  let breakdown = [];

  if (category === 'house_cleaning') {
    estimate += rooms * rates.house_cleaning;
    estimate += toilets * rates.toilet;
    breakdown.push(`₦${rooms * rates.house_cleaning} for ${rooms} rooms`);
    breakdown.push(`₦${toilets * rates.toilet} for ${toilets} toilets`);
    if (extras.kitchen) {
      estimate += 2000;
      breakdown.push("₦2000 for kitchen");
    }
    if (extras.livingRoom) {
      estimate += 1500;
      breakdown.push("₦1500 for living room");
    }
    if (extras.windowCleaning) {
      estimate += 1000;
      breakdown.push("₦1000 for window cleaning");
    }
  } else if (category === 'laundry') {
    estimate += clothesCount * rates.laundry;
    breakdown.push(`₦${clothesCount * rates.laundry} for ${clothesCount} clothes`);
  } else if (category === 'fumigation') {
    estimate += rates.fumigation;
    breakdown.push(`₦${rates.fumigation} for fumigation service`);
  }
  return (
    <SafeAreaView style={Typography.container}>
      <Header title={"Price Estimate"} />
      <Text style={styles.header}>Estimated Cost</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Service Type: Clean</Text>
        <Text style={styles.label}>
          Date: {date} at {time}
        </Text>

        {breakdown.map((item, idx) => (
          <Text key={idx} style={styles.item}>
            {item}
          </Text>
        ))}

        <Text style={styles.total}>Total: ₦{estimate.toLocaleString()}</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          navigation.navigate("NearbyJanitors", { priceEstimate: estimate })
        }
      >
        <Text style={styles.buttonText}>Continue to Select Janitor</Text>
      </TouchableOpacity>
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
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  item: {
    fontSize: 15,
    marginBottom: 3,
    color: "#555",
  },
  total: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
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
