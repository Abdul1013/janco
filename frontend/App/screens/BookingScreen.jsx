//set services display to be dynamically fetched from dashboards
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";

import CheckBox, { Checkbox } from "expo-checkbox";
import { Colors, Spacing, Typography } from "../components/theme/Theme";
import Header from "../components/Header";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../hooks/authContext";
import useJob from "../hooks/useJob";
import Button from "../components/ui/Button";

export default function BookingScreen({ navigation }) {
  const { profile, user } = useAuth();
  const { createJob } = useJob();

  const [category, setCategory] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  //numeric inputs
  const [rooms, setRooms] = useState("");
  const [toilets, setToilets] = useState("");
  const [clothesCount, setClothesCount] = useState("0");
  const [extras, setExtras] = useState({
    kitchen: false,
    livingRoom: false,
    windowCleaning: false,
  });
  const categories = [
    {
      id: "house_cleaning",
      label: "House",
      icon: (
        <MaterialIcons
          name="cleaning-services"
          size={48}
          color={Colors.dark.cardBorder}
        />
      ),
    },
    {
      id: "laundry",
      label: "Laundry",
      icon: (
        <MaterialIcons
          name="dry-cleaning"
          size={48}
          color={Colors.dark.cardBorder}
        />
      ),
    },
    {
      id: "fumigation",
      label: "Fumigate",
      icon: (
        <MaterialCommunityIcons
          name="spray-bottle"
          size={44}
          color={Colors.dark.cardBorder}
        />
      ),
    },
  ];

  const renderForm = () => {
    switch (category) {
      case "house_cleaning":
        return (
          <HouseCleaningForm
            rooms={rooms}
            setRooms={setRooms}
            toilets={toilets}
            setToilets={setToilets}
            extras={extras}
            setExtras={setExtras}
          />
        );
      case "laundry":
        return (
          <LaundryForm
            clothesCount={clothesCount}
            setClothesCount={setClothesCount}
          />
        );
      case "fumigation":
        return <Text style={Typography.header}>Coming Soon</Text>;
      default:
        return (
          <Text style={Typography.header}>
            No job type selected. Pick a job to get Started
          </Text>
        );
    }
  };

  const handleBookingSubmit = async () => {
    try {
      if (!category) {
        Alert.alert("Validation Error", "Please select a service type");
        return;
      }
      if (!date || !time) {
        Alert.alert("Validation Error", "Please provide date and time");
        return;
      }

      setIsBooking(true);

      // Prepare booking data
      const bookingData = {
        service_type: category,
        scheduled_date: date,
        scheduled_time: time,
        address: profile?.address || "",
        latitude: user?.lat || 0,
        longitude: user?.lng || 0,
        room_data: JSON.stringify([
          { room: "bedroom", count: parseInt(rooms || 0, 10) },
          { room: "toilet", count: parseInt(toilets || 0, 10) },
        ]),
        extras: JSON.stringify(extras),
        notes: notes,
      };

      // Create job in database (optional - can skip if we just navigate with params)
      const created = await createJob(bookingData);

      setIsBooking(false);

      // Navigate to price estimate with all data
      navigation.navigate("PriceEstimate", {
        category,
        rooms: parseInt(rooms || 0, 10),
        toilets: parseInt(toilets || 0, 10),
        clothesCount: parseInt(clothesCount || 0, 10),
        extras,
        date,
        time,
        notes,
        address: profile?.address || "",
        userLocation: { 
          lat: user?.lat || 0, 
          lng: user?.lng || 0 
        },
      });
    } catch (err) {
      setIsBooking(false);
      console.error("Booking error:", err);
      Alert.alert("Booking Error", err.message || "Please try again.");
    }
  };

  return (
    <View style={[Typography.container, { marginBottom: -30 }]}>
      <Header title={"Book a Service"} />
      <Text style={Typography.header}>
        Choose a service category to begin booking
      </Text>

      <ScrollView horizontal contentContainerStyle={styles.iconRow}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setCategory(cat.id)}
            style={[styles.iconWrapper, category === cat.id && styles.active]}
          >
            {cat.icon}
            <Text style={Typography.note}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingVertical: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="preferred date for cleaning"
            placeholderTextColor={Colors.dark.accent}
            style={Typography.input}
          />
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="preferred time for cleaning"
            placeholderTextColor={Colors.dark.accent}
            style={Typography.input}
          />
          <TextInput
            value={profile?.address}
            placeholder="Address"
            placeholderTextColor={Colors.dark.accent}
            style={Typography.input}
            editable={true}
          />
        </View>

        {renderForm()}

        <View>
          <Text style={[Typography.note, { marginVertical: Spacing.sm }]}>
            Any extra notes?
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Handle whites separately..."
            placeholderTextColor={Colors.dark.accent}
            multiline
            style={Typography.input}
          />
        </View>
        <Button
          title={isBooking ? "Processing..." : "Continue To Estimate"}
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleBookingSubmit}
          disabled={isBooking}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: "center",
  },

  continueButton: {
    // marginTop: "auto",
    // marginBottom: -30,
    backgroundColor: "#F9CB40",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  continueText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  iconWrapper: {
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.dark.cardBackground2,
    borderRadius: 12,
    marginHorizontal: 6,
    // height: 100,
    flex: 1,
  },
  iconRow: {
    justifyContent: "space-between",
    flex: 1,
    height: 100,
    marginBottom: Spacing.lg,
    borderBottomColor: Colors.dark.accent,
    borderBottomWidth: 0.5,
    padding: Spacing.xxs,
  },
  active: {
    backgroundColor: Colors.dark.cardBackground,
  },
});

function HouseCleaningForm({
  rooms,
  setRooms,
  toilets,
  setToilets,
  extras,
  setExtras,
}) {
  const [isChecked] = useState(false);

  return (
    <View>
      <TextInput
        value={String(rooms)}
        onChangeText={setRooms}
        keyboardType="numeric"
        style={Typography.input}
        placeholder="How many rooms?"
        placeholderTextColor={Colors.dark.accent}
      />
      <TextInput
        value={String(toilets)}
        onChangeText={setToilets}
        keyboardType="numeric"
        style={Typography.input}
        placeholder="How many toilets?"
        placeholderTextColor={Colors.dark.accent}
      />
      <Text style={Typography.note}>Extras:</Text>

      <View style={Typography.checkBox}>
        <Text style={Typography.note}>Kitchen</Text>
        <Checkbox
          value={extras.kitchen}
          onValueChange={(v) => setExtras({ ...extras, kitchen: v })}
          color={isChecked ? "#4630EB" : undefined}
        />
      </View>
      <View style={Typography.checkBox}>
        <Text style={Typography.note}>Living Room</Text>
        <Checkbox
          value={extras.livingRoom}
          onValueChange={(v) => setExtras({ ...extras, livingRoom: v })}
          color={isChecked ? "#4630EB" : undefined}
        />
      </View>
      <View style={Typography.checkBox}>
        <Text style={Typography.note}>Window Cleaning</Text>
        <CheckBox
          value={extras.windowCleaning}
          onValueChange={(v) => setExtras({ ...extras, windowCleaning: v })}
          color={isChecked ? "#4630EB" : undefined}
        />
      </View>
    </View>
  );
}

function LaundryForm({ clothesCount, setClothesCount }) {
  const [clothTypes, setClothTypes] = useState({
    shirts: false,
    trousers: false,
    bedsheets: false,
    delicates: false,
  });
  const [extraServices, setExtraServices] = useState({
    ironing: false,
    hangDry: false,
  });
  // const [notes, setNotes] = useState("");

  return (
    <View style={Typography.subtitle}>
      <Text style={Typography.note}>How many clothes?</Text>
      <TextInput
        value={String(clothesCount)}
        onChangeText={setClothesCount}
        keyboardType="numeric"
        style={Typography.input}
        placeholder="Number of items"
        placeholderTextColor={Colors.dark.accent}
      />

      <Text style={[Typography.note, { marginTop: 8 }]}>Cloth Types:</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 6,
        }}
      >
        <Checkbox
          value={clothTypes.shirts}
          onValueChange={(v) => setClothTypes({ ...clothTypes, shirts: v })}
        />
        <Text style={[Typography.note, { marginLeft: 8 }]}>Shirts</Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 6,
        }}
      >
        <Checkbox
          value={clothTypes.trousers}
          onValueChange={(v) => setClothTypes({ ...clothTypes, trousers: v })}
        />
        <Text style={[Typography.note, { marginLeft: 8 }]}>Trousers</Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 6,
        }}
      >
        <Checkbox
          value={clothTypes.bedsheets}
          onValueChange={(v) => setClothTypes({ ...clothTypes, bedsheets: v })}
        />
        <Text style={[Typography.note, { marginLeft: 8 }]}>Bedsheets</Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 6,
        }}
      >
        <Checkbox
          value={clothTypes.delicates}
          onValueChange={(v) => setClothTypes({ ...clothTypes, delicates: v })}
        />
        <Text style={[Typography.note, { marginLeft: 8 }]}>Delicates</Text>
      </View>

      <Text style={[Typography.note, { marginTop: 12 }]}>Extra Services:</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 6,
        }}
      >
        <Checkbox
          value={extraServices.ironing}
          onValueChange={(v) =>
            setExtraServices({ ...extraServices, ironing: v })
          }
        />
        <Text style={[Typography.note, { marginLeft: 8 }]}>Ironing</Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 6,
        }}
      >
        <Checkbox
          value={extraServices.hangDry}
          onValueChange={(v) =>
            setExtraServices({ ...extraServices, hangDry: v })
          }
        />
        <Text style={[Typography.note, { marginLeft: 8 }]}>Hang Dry</Text>
      </View>
    </View>
  );
}
