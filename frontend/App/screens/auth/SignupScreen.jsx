import React, { useState } from "react";
import { View, TouchableOpacity, KeyboardAvoidingView, Image, Text,TextInput } from "react-native";
import { supabase } from '../../lib/supabase'
import { Typography } from "../../components/theme/Theme";
import { useNavigation } from "@react-navigation/native";
export default function SigupScreen() {
    const navigation = useNavigation()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)

    async function register() {
        setLoading(true)
        const { user, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        })

        if (!error && !user) {
            setLoading(false);
            alert("check your email for login link")
        }
        if (error) {
            setLoading(false)
            alert(error.message)
        }

    }

    return (
        <KeyboardAvoidingView behavior="height" enabled style={{ flex: 1 }}>
            <View style={Typography.container}>
                <Text
                    fontWeight="bold"
                    size="h3"
                    style={{
                        alignSelf: "center",
                        padding: 30,
                    }}
                >
                    Register
                </Text>
                <Text>Email</Text>
                <TextInput
                  
                    placeholder="Enter your email"
                    value={email}
                    autoCapitalize="none"
                    autoCompleteType="off"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={(text) => setEmail(text)}
                    style={Typography.input}
                />

                <Text style={{ marginTop: 15 }}>Password</Text>
                <TextInput
                  
                    placeholder="Enter your password"
                    value={password}
                    autoCapitalize="none"
                    autoCompleteType="off"
                    autoCorrect={false}
                    secureTextEntry={true}
                    onChangeText={(text) => setPassword(text)}
                    style={Typography.input}

                />
                <TouchableOpacity
                
                    onPress={() => {
                        register();
                    }}
                    style={{
                        marginTop: 20,
                    }}
                    disabled={loading}
                > <Text>
                    {loading ? "Loading" : "Create an account"}</Text></TouchableOpacity>

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 15,
                        justifyContent: "center",
                    }}
                >
                    <Text size="md">Already have an account?</Text>
                    <TouchableOpacity
                        onPress={() => {
                            navigation.navigate("Login");
                        }}
                    >
                        <Text
                            size="md"
                            fontWeight="bold"
                            style={{
                                marginLeft: 5,
                            }}
                        >
                            Login here
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
        </KeyboardAvoidingView>
    )
}