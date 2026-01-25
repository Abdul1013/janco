import React, { useState, useEffect} from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../hooks/authContext";
import { supabase } from "../../lib/supabase";
import useUserLocation from "../../hooks/useUserLocation";
import { Typography } from "../../components/theme/Theme";
// import
export default function RegistrationScreen({ navigation }) {
  const { user, getUserProfile } = useAuth();
  const { address, coords, errorMsg: locationError } = useUserLocation();
  const [userName, setUserName] = useState("");
  const [phone, setPhone] = useState("");
  // const [address, setAddress] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address) setUserAddress(address);
  }, [address]);

  const handleRegistration = async () => {
    const { lat, lng } = coords;

    if (!userName || !phone || !address || !landmark)
      return alert("Please fill all fields");
    setLoading(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      user_name: userName,
      phone,
      address: userAddress,
      landmark,
      lat,
      lng,
      is_registered: true,
    });

    setLoading(false);
    if (error) {
      console.error(error);
      alert("failed to save profile");
    } else {
      await getUserProfile(user.id);

      alert("Registration successful!");
    }
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complete Your Registration</Text>

      <TextInput
        placeholder="User Name"
        value={userName}
        onChangeText={setUserName}
        style={styles.input}
      />

      <TextInput
        placeholder="Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />
      {/* <TextInput
        placeholder="Address"
        value={address}
        onChangeText={setAddress}
        style={styles.input}
      /> */}

      <TextInput
        placeholder="Address"
        value={userAddress}
        onChangeText={setUserAddress} // Allow user to edit manually
        style={styles.input}
      />
      <TextInput
        placeholder="Nearest LandMark"
        value={landmark}
        onChangeText={setLandmark}
        style={Typography.input}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleRegistration}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit</Text>
        )}
      </TouchableOpacity>
      {locationError && <Text style={{ color: "red" }}>{locationError}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#4a90e2",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
// import Toast from 'react-native-toast-message';

// Toast.show({
//   type: 'error',
//   text1: 'Error',
//   text2: 'Failed to save profile',
// });

// const [userName, setUserName] = useState(user?.user_metadata?.full_name || "");
