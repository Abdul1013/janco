import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import {
  ScrollView,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Image,
  Text, TextInput
} from "react-native";
import { supabase } from "../../lib/supabase";


import { Typography } from "../../components/theme/Theme";
import Button from "../../components/ui/Button";


export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    const { user, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (!error && !user) {
      setLoading(false);
      // alert("Check your email for the login link!");
    }
    if (error) {
      setLoading(false);
      alert(error.message);
    }
  }
  return (
    <KeyboardAvoidingView behavior="height" enabled style={{ flex: 1 }}>
      <View
        style={Typography.container}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",

          }}
        >
          <Image
            resizeMode="contain"
            style={{
              height: 120,
              width: 120,
            }}
            source={require("../../../assets/logo.png")}
          />
        </View>
        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            
            style={
            Typography.header}
           
          >
            Login to Get Started
          </Text>
          <Text   style={Typography.subtitle}>Email</Text>
          <TextInput
           style={Typography.input}
            placeholder="Enter your email"
            value={email}
            autoCapitalize="none"
            autoCompleteType="off"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={(text) => setEmail(text)}
          />

          <Text   style={Typography.subtitle}>Password</Text>
          <TextInput
            style={Typography.input}
            placeholder="Enter your password"
            value={password}
            autoCapitalize="none"
            autoCompleteType="off"
            autoCorrect={false}
            secureTextEntry={true}
            onChangeText={(text) => setPassword(text)}
          />

         <Button title={"Login"} onPress={() => 
              login()}/>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 15,
              justifyContent: "center",
            }}
          >
            <Text style={Typography.note}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => {
                navigation.navigate("Signup");
              }}
            >
              <Text
               
                style={Typography.link}
              >
                Register here
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 10,
              justifyContent: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => {
                navigation.navigate("ForgetPassword");
              }}
            >
              <Text style={Typography.note}>
                Forget password
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 30,
              justifyContent: "center",
            }}
          >

          </View>
        </View>
      </View>

    </KeyboardAvoidingView>
  );
}
// useEffect(() => {
//   const checkSession = async () => {
//     const { data } = await supabase.auth.getSession()
//     if (data.session) {
//       navigation.replace('Home')
//     } else {
//       navigation.replace('Login')
//     }
//   }
//   checkSession()
// }, [])

// const checkIfProfileExists = async (userId) => {
//   const { data, error } = await supabase.from('users').select().eq('id', userId).single()
//   return data !== null
// }
