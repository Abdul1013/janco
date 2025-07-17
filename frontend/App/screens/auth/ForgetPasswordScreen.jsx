import React, { useState } from "react";
import { View, TouchableOpacity, KeyboardAvoidingView, Image, TextInput, Text, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { Typography } from "../../components/theme/Theme";

import { useNavigation } from "@react-navigation/native";
export default function ForgetPasswordScreen() {
    const navigation = useNavigation();
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)

    async function forgetPassword() {
        setLoading(true)

        const { data, error } = await supabase.auth.resetPasswordForEmail(
            email
        );
        if (error) {
            alert(error.message)
        }else{
            alert("password reset link set. check your email")
        }
        setLoading(false);
    }
    return (
        <KeyboardAvoidingView behavior="height" enabled style={{ flex: 1 }}>
            <View style={Typography.container}>
                <Text
                    size="h3"
                    fontWeight="bold"
                    style={{
                        alignSelf: "center",
                        padding: 30,
                    }}
                >
                    Forget Password
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
                />
                <TouchableOpacity

                    onPress={() => {
                        forgetPassword();
                    }}
                    style={{
                        marginTop: 20,
                    }}
                    disabled={loading}
                >
                    <Text>{loading ? "Loading" : "Send email"}</Text>
                </TouchableOpacity>

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

            </View>
        </KeyboardAvoidingView>
    )
}
