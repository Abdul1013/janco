import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import * as Linking from 'expo-linking  '
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { Typography } from "../components/theme/Theme";

export default function AuthCallbackScreen() {
    const navigation = useNavigation();

    useEffect(() => {
        const handleDeepLink = async () => {
            const url = Linking.useURL();
            if (url) {
                const params = new URLSearchParams(url.split('#')[1]);

                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');
                const type = params.get('type');

                if (access_token && refresh_token) {
                    const { error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });

                    if (!error) {
                        if (type === 'recovery') {
                            navigation.navigate('UpdatePassword');
                        } else {
                            navigation.replace('Login')
                        }
                    } else {
                        console.error('session error: ', error.message)
                    }
                }
            }
        }
        handleDeepLink();
    }, []);

    return (
        <View style={Typography.container}>
            <ActivityIndicator />
            <Text>Restoring session ...</Text>

        </View>
    )
}
