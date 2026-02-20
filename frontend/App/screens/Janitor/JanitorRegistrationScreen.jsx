import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  scrollView,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Spacing, Typography } from "../../components/theme/Theme";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../components/Header";

export default function JanitorRegistrationScreen({ navigation }) {
  const { profile, user } = useAuth();
  const [hasApplied, setHasApplied] = useState(false);
  const [loading,setLoading] = useState(false);
  const [form, setForm] = useState({
    services_offered: "",
    // location: '',
    bio: "",
    is_available: false,
  });

  useEffect(() => {
    const checkIfApplied = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("janitors")
        .select("janitor_id")
        .eq("janitor_id", user.id)
        .maybeSingle();

      if (data) setHasApplied(true);
      setLoading(false)
    };

    if (user?.id) checkIfApplied();
  }, [user]);
  const fields = [
    {
      label: "Services Offered",
      key: "services_offered",
      placeholder: "Cleaning, Laundry",
    },
    {
      label: "Short Bio",
      key: "bio",
      placeholder: "Why should we choose you?",
    },
  ];

  const handleChange = (key, value) => {
    setForm((Prev) => ({ ...Prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.services_offered || !form.bio) {
      return Alert.alert("All fields are required!");
    }
    try {
      //add is janitor field to user profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_janitor: true })
        .eq("id", user.id);

      if (updateError) throw updateError;

      //insert janitor record
      const { error: insertError } = await supabase.from("janitors").insert({
        janitor_id: user.id,
        janitor_name: profile?.user_name,
        location: profile?.address,
        ...form,
        status: "pending",
      });

      if (insertError) throw insertError;

      Alert.alert("Submitted", "Awaiting admin approval");
      setHasApplied(true);
      navigation.navigate("JanitorStatus");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "something went wrong during registration ");
    }
  };
if (loading) {
  return (
    <SafeAreaView style={[Typography.container, {alignItems: 'center', justifyContent: 'center'}]}>
      <ActivityIndicator size="large" color="#CDDC39" />
    </SafeAreaView>
  );
}
  

  return (
    <SafeAreaView style={Typography.container}>
      <Header title="Janitor Registration"/>
      {!hasApplied ? (
        <ScrollView>
          <Text style={Typography.subtitle}>Become a Janitor</Text>
          <Text style={Typography.link}>Full Name</Text>
          <TextInput
            value={profile?.user_name}
            editable={false}
            style={Typography.input}
          />
          <Text style={Typography.link}>Location</Text>
          <TextInput
            value={profile?.address}
            editable={false}
            style={Typography.input}
          />
          {fields.map(({ key, label, placeholder }) => (
            <View key={key} style={{ marginTop: 12 }}>
              <Text style={Typography.link}>{label}</Text>
              <TextInput
                placeholder={placeholder}
                value={form[key]}
                onChangeText={(val) => handleChange(key, val)}
                style={Typography.input}
                multiline={key === "bio"}
                numberOfLines={key === "bio" ? 4 : 1}
              />
            </View>
          ))}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginVertical: 16,
            }}
          >
            <Text style={[Typography.link, {marginRight: Spacing.md}]}>Available for Jobs?</Text>
            <Switch
              value={form.is_available}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, is_available: val }))
              }
            />
          </View>
          <Button
            title="Submit Application"
            onPress={handleSubmit}
            color="#007bff"
          />
        </ScrollView>
      ) : (
        <View style={styles.statusContainer}>
          <Text style={Typography.title}>🎉 Application Submitted</Text>
          <Text style={styles.statusText}>
            You've already applied to become a janitor. Tap below to check your
            approval status.
          </Text>
          <Button
            title="Check Application Status"
            onPress={() => navigation.navigate("JanitorStatus")}
            color="#8BC34A"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  label: { fontWeight: "bold", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  inputDisabled: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#f2f2f2",
    color: "#888",
  },
  statusContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 10,
},
statusText: {
  textAlign: 'center',
  fontSize: 16,
  color: '#666',
  marginBottom: 20,
},

});
