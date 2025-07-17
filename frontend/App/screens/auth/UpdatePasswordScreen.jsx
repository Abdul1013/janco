import React,{useState} from "react";
import { View, TextInput, Button, Alert, Text } from "react-native";
import { supabase } from "../../lib/supabase";
import { Typography } from "../../components/theme/Theme";

export default function UpdatePasswordScreen(){
    const [password, setPassword] = useState('');

    const handlePasswordChange = async () => {
        const {error} = await supabase.auth.updateUser({password});
        if(error) Alert.alert("Error", error.message);
        else Alert.alert('Success', 'Passwordupdated!');
    };

    return(
        <View style={Typography.container}>
            <Text>New Password</Text>
            <TextInput secureTextEntry
            value={password}
            onChangeText={setPassword}
            // style={}
            />
            <Button title="Update Password" onPress={handlePasswordChange}/>
        </View>
    )


}