import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";

import CheckBox, { Checkbox } from "expo-checkbox";
import { Colors, Spacing, Typography } from "../components/theme/Theme";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../components/Header";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../hooks/authContext";
import useJobs from "../hooks/useJob";
import Button from "../components/ui/Button";

export default function BookingScreen({ navigation }) {
  const { profile, user } = useAuth();
  const { createJob } = useJobs();
  const [category, setCategory] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [rooms, setRooms] = useState("")
  const [toilets, setToilets] = useState("")
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
        return <HouseCleaningForm />;
      case "laundry":
        return <LaundryForm />;
      case "fumigation":
        return (
        <Text style={Typography.header}> 
          Coming Soon
        </Text>);
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
    const bookingData = {
      service_type: category,
      scheduled_date: date,
      address: profile?.address,
      latitude: user?.lat,
      longitude: user?.lng,
      room_data: JSON.stringify([
        { room: "bedroom", count: rooms },
        { room: "toilet", count: toilets },
      ]),
      extras: JSON.stringify(extras),
    };

    const created = await createJob(bookingData);

    // 👇 Send form data along with job
    navigation.navigate("EstimateScreen", {
      job: created,
      category,
      date,
      time,
      address: profile?.address,
      userLocation: { lat: user?.lat, lng: user?.lng },
      rooms,
      toilets,
      clothesCount,
      // extras,
      notes,
    });
  } catch (err) {
    Alert.alert("Booking Failed", "Please try again.");
  }
};

  return (
    <SafeAreaView style={[Typography.container, {marginBottom: -40}]}>
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

        {/* <HouseCleaningForm /> */}
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
   <Button title="Continue To Estimate"
   variant="primary"
   size="lg"
   fullWidth
   onPress={()=> navigation.navigate('PriceEstimate', {
  category,
  rooms,
  toilets,
  // clothesCount,
  // extras,
  date,
  time,
  notes,
  address: profile?.address,
  userLocation: {
    lat: user?.lat || 0,
    lng: user?.lng || 0,
  }})}
   />
      </ScrollView>

 
    </SafeAreaView>
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



const HouseCleaningForm = () => {
  const [rooms, setRooms] = useState(1);
  const [toilets, setToilets] = useState(1);
  const [isChecked, setIsChecked] = useState(false);
  const [extras, setExtras] = useState({
    kitchen: false,
    livingRoom: false,
    windowCleaning: false,
  });
  const [notes, setNotes] = useState("");

 
  return (
    <View>
      <TextInput
        value={rooms}
        onChangeText={setRooms}
        keyboardType="numeric"
        style={Typography.input}
        placeholder="How many rooms?"
      />

      <TextInput
        value={toilets}
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
          label="Kitchen"
          value={extras.kitchen}
          onValueChange={(v) => setExtras({ ...extras, kitchen: v })}
          color={isChecked ? "#4630EB" : undefined}
        />
      </View>
      <View style={Typography.checkBox}>
        <Text style={Typography.note}>Living Room</Text>
        <Checkbox
          label="Living Room"
          value={extras.livingRoom}
          onValueChange={(v) => setExtras({ ...extras, livingRoom: v })}
          color={isChecked ? "#4630EB" : undefined}
        />
      </View>
      <View style={Typography.checkBox}>
        <Text style={Typography.note}>Window Cleaning</Text>

        <CheckBox
          label="Window Cleaning"
          value={extras.windowCleaning}
          onValueChange={(v) => setExtras({ ...extras, windowCleaning: v })}
          color={isChecked ? "#4630EB" : undefined}
        />
      </View>
    </View>
  );
};

const LaundryForm = () => {
  const [clothesCount, setClothesCount] = useState(10);
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
  const [notes, setNotes] = useState("");

  return (
    <View>
      <Text>How many clothes?</Text>
      <TextInput
        value={clothesCount}
        onChangeText={setClothesCount}
        keyboardType="numeric"
      />
      <Text>Cloth Types:</Text>
      <Checkbox
        label="Shirts"
        value={clothTypes.shirts}
        onValueChange={(v) => setClothTypes({ ...clothTypes, shirts: v })}
      />
      <Checkbox
        label="Trousers"
        value={clothTypes.trousers}
        onValueChange={(v) => setClothTypes({ ...clothTypes, trousers: v })}
      />
      <Checkbox
        label="Bedsheets"
        value={clothTypes.bedsheets}
        onValueChange={(v) => setClothTypes({ ...clothTypes, bedsheets: v })}
      />
      <Checkbox
        label="Delicates"
        value={clothTypes.delicates}
        onValueChange={(v) => setClothTypes({ ...clothTypes, delicates: v })}
      />

      <Text>Extra Services:</Text>
      <Checkbox
        label="Ironing"
        value={extraServices.ironing}
        onValueChange={(v) =>
          setExtraServices({ ...extraServices, ironing: v })
        }
      />
      <Checkbox
        label="Hang Dry"
        value={extraServices.hangDry}
        onValueChange={(v) =>
          setExtraServices({ ...extraServices, hangDry: v })
        }
      />
    </View>
  );
};

