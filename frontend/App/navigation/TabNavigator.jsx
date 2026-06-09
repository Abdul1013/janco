import React from "react";
import { TouchableOpacity, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";
import { useTheme } from "../constants/theme/ThemeContext";
import { useAuth } from "../hooks/authContext";
import HomeScreen from "../screens/HomeScreen";
import BookingScreen from "../screens/BookingScreen";
import BookingHistoryScreen from "../screens/BookingHistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import JanitorDashBoardScreen from "../screens/Janitor/JanitorDashBoardScreen";
import JanitorScheduleScreen from "../screens/Janitor/JanitorScheduleScreen";
import AppText from "../components/ui/AppText";

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { colors, spacing } = useTheme();
  const { profile, viewAsCustomer, setViewAsCustomer } = useAuth();
  const isJanitor = profile?.role === "janitor";

  // A janitor in customer-preview mode sees the customer layout
  const showCustomerView = !isJanitor || viewAsCustomer;

  return (
    <View style={{ flex: 1 }}>
      {/* Banner: only visible when a janitor is previewing the customer UI */}
      {isJanitor && viewAsCustomer && (
        <View
          style={{
            backgroundColor: colors.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingVertical: 8,
          }}
        >
          <AppText
            variant="bodySmall"
            style={{ color: colors.onPrimary, flex: 1 }}
          >
            Previewing customer view
          </AppText>
          <TouchableOpacity
            onPress={() => setViewAsCustomer(false)}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: colors.onPrimary + "22",
            }}
          >
            <AppText
              variant="bodySmall"
              style={{ color: colors.onPrimary, fontWeight: "700" }}
            >
              Back to Dashboard
            </AppText>
          </TouchableOpacity>
        </View>
      )}

      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.outlineVariant,
          },
        }}
      >
        {/* ── Tab 1: Home ── */}
        <Tab.Screen
          name="HomeScreen"
          component={showCustomerView ? HomeScreen : JanitorDashBoardScreen}
          options={{
            tabBarLabel: showCustomerView ? "Home" : "Dashboard",
            tabBarIcon: ({ color }) => (
              <MaterialIcons
                name={showCustomerView ? "home" : "dashboard"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        {/* ── Tab 2: Book (customers) | Schedule (janitors) ── */}
        <Tab.Screen
          name="Clean"
          component={showCustomerView ? BookingScreen : JanitorScheduleScreen}
          options={{
            tabBarLabel: showCustomerView ? "Book" : "Schedule",
            tabBarIcon: ({ color }) => (
              <MaterialIcons
                name={showCustomerView ? "cleaning-services" : "event-note"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        {/* ── Tab 3: Profile (shared) ── */}
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: "Profile",
            tabBarIcon: ({ color }) => (
              <FontAwesome name="user" size={24} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}
