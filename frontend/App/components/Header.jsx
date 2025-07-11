import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { Spacing, Typography } from "./theme/Theme";

export default function Header({ title }) {
  const navigation = useNavigation();
  return (
    <View
      style={{
        justifyContent: "space-between",
        display: "flex",
        flexDirection: "row",
        marginBottom: Spacing.xs,
      }}
    >
      {" "}
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View>
        <Text style={Typography.title}>{title}</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
        <MaterialIcons name="notifications" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}
