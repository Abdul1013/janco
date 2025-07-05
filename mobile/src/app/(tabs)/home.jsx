import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/FontAwesome5";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Typography, Colors, Spacing } from "../../../components/theme/Theme";
import { useNavigation } from "@react-navigation/native";
import { Octicons } from "@expo/vector-icons";

const serviceCategories = [
  { id: "1", title: "Housekeeping", icon: "broom" },
  { id: "2", title: "Laundry", icon: "tshirt" },
  {
    id: "3",
    title: "Fumigation",
    com: "[coming soon]",
    icon: "bug",
  },
  {
    id: "4",
    title: "Post-Construction Clean-up ",
    com: "[coming soon]",
    icon: "tools",
  },
];

export default function HomeScreen() {
  const navigation = useNavigation();


  return (
    <SafeAreaView style={styles.container}>
      {/* <Image source={require('../assets/images/logo.png')} style={{width:200, height:100}} /> */}
      <View
        style={{
          justifyContent: "space-between",
          display: "flex",
          flexDirection: "row",
        }}
      >
        <View>
          <Text style={Typography.title}>Hello, John Deo</Text>
          <Text
            style={[
              Typography.default,
              { color: Colors.light.textMuted, marginBottom: 15 },
            ]}
          >
            📍 New Garage Ibadan
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <MaterialIcons name="notifications" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* <Icon name="alert"/> */}
      <View style={styles.gridContainer}>
        {serviceCategories.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.gridCardItem}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate("ServiceBooking", { serviceType: item.title })
            }
          >
            <Icon name={item.icon} size={24} color="#2D2D2D" />
            <Text style={styles.cardText}>{item.title}</Text>
            {item.com && <Text style={styles.comingSoon}>{item.com}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.columnCard}>
        <Text style={Typography.subtitle}>🗓 Your next booking is on</Text>
        <Text style={[Typography.default, { color: Colors.light.textMuted }]}>
          Thursday, June 27 - 5:00 PM
        </Text>
        <TouchableOpacity style={styles.bookingButton}>
          <Text style={styles.bookingText}>Book A Service</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridRow}>
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => navigation.navigate("PricingEstimate")}
        >
          <Octicons name="history" size={24} color="black" />
          <Text style={styles.gridText}>Summaries</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => navigation.navigate("Chat")}
        >
          <Icon name="comments" size={22} color="#000" />
          <Text style={styles.gridText}>Talk to Janitor</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    // justifyContent:"space-evenly",
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 15,
  },
  card: {
    flex: 1,
    height: 120,
    marginHorizontal: Spacing.xxs,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.text,
    borderWidth: 1,
  },
  cardText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign:'center'
  },
  comingSoon: {
    fontSize: 12,
    fontStyle: "italic",
    color: Colors.light.textMuted,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginVertical: 20,
  },

  gridCardItem: {
    width: "48%",
    height: 120,
    marginBottom: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.text,
    borderWidth: 1,
  },

  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    columnGap: 10,
    // marginBottom: 20,
  },
  gridCard: {
    flex: 1,
    backgroundColor: Colors.light.accent,
    borderWidth: 0.5,
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  gridText: {
    marginTop: 10,
    color: "#000",
    fontWeight: "bold",
  },
  columnCard: {
    alignItems: "center",
    justifyContent:"center",
    backgroundColor: Colors.dark.primary,
    borderColor:Colors.dark.border,
    borderWidth: 1,
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
  },
  bookingButton: {
    borderColor: Colors.dark.shadow,
    borderWidth: 0.5,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: Spacing.xs,
    marginVertical: 10,
  },
  bookingText: {
    color: "white",
  },
});
