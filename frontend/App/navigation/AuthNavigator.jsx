import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/auth/LoginScreen";
import SigupScreen from "../screens/auth/SignupScreen";
import ForgetPasswordScreen from "../screens/auth/ForgetPasswordScreen";
import UpdatePasswordScreen from "../screens/auth/UpdatePasswordScreen";
import RegistrationScreen from "../screens/auth/RegistrationScreen";


const Authstack = createNativeStackNavigator();

export default function AuthNavigator() {
    return (
        <Authstack.Navigator screenOptions={{ headerShown: false }}>

            <Authstack.Screen name="Login" component={LoginScreen} />
            <Authstack.Screen name="Signup" component={SigupScreen} />
            <Authstack.Screen name="ForgetPassword" component={ForgetPasswordScreen} />
            <Authstack.Screen name="UpdatePassword" component={UpdatePasswordScreen} />
            <Authstack.Screen name="Registration" component={RegistrationScreen} />
        </Authstack.Navigator>
    )
}