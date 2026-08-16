import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../constants/theme/ThemeContext";
import * as bookingApi from "../../api/bookingApi";
import ScreenWrapper from "../components/ui/ScreenWrapper";
import AppCard from "../components/ui/AppCard";
import AppText from "../components/ui/AppText";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";

const SERVICE_ICONS = {
  house_cleaning: "home",
  deep_cleaning: "cleaning-services",
  laundry: "local-laundry-service",
  fumigation: "pest-control",
};

const STATUS_META = {
  pending: { label: "Pending", bg: "#FFF3E0", text: "#E65100" },
  confirmed: { label: "Confirmed", bg: "#E3F2FD", text: "#1565C0" },
  in_progress: { label: "In Progress", bg: "#E8F5E9", text: "#2E7D32" },
  completed: { label: "Completed", bg: "#F3E5F5", text: "#6A1B9A" },
  cancelled: { label: "Cancelled", bg: "#FFEBEE", text: "#B71C1C" },
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "in_progress"]);

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatService(type) {
  return (type || "Service")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BookingHistoryScreen() {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();

  const [filter, setFilter] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Backend only accepts exact status strings — "active" is a client-side concept
      const apiStatus = filter === "active" ? "" : filter;
      const { data } = await bookingApi.getUserBookings(1, apiStatus);
      let list = data?.jobs || [];
      if (filter === "active") {
        list = list.filter((j) => ACTIVE_STATUSES.has(j.status));
      }
      setJobs(list);

      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    },
    [filter],
  );

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const renderJob = ({ item }) => {
    const meta = STATUS_META[item.status] || {
      label: item.status,
      bg: "#eee",
      text: "#444",
    };
    const iconName = SERVICE_ICONS[item.service_type] || "cleaning-services";

    return (
      // service booking list
      <AppCard
        elevation={1}
        onPress={() => navigation.navigate("JobStatus", { job: item })}
        style={{ marginBottom: spacing.sm }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Service icon */}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              backgroundColor: colors.primaryContainer,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            <MaterialIcons name={iconName} size={24} color={colors.primary} />
          </View>

          {/* Details */}
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <AppText
                variant="bodyLarge"
                style={{
                  color: colors.onSurface,
                  fontWeight: "600",
                  flex: 1,
                  marginRight: spacing.sm,
                }}
              >
                {formatService(item.service_type)}
              </AppText>
              <View
                style={{
                  backgroundColor: meta.bg,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <AppText
                  variant="bodySmall"
                  style={{ color: meta.text, fontWeight: "700", fontSize: 11 }}
                >
                  {meta.label}
                </AppText>
              </View>
            </View>

            <AppText
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant, marginTop: 2 }}
            >
              {formatDate(item.scheduled_date || item.created_at)}
              {item.scheduled_time ? `  ·  ${item.scheduled_time}` : ""}
            </AppText>

            {item.address ? (
              <AppText
                variant="bodySmall"
                style={{ color: colors.onSurfaceVariant }}
                numberOfLines={1}
              >
                {item.address}
              </AppText>
            ) : null}

            {item.price ? (
              <AppText
                variant="bodySmall"
                style={{
                  color: colors.primary,
                  fontWeight: "600",
                  marginTop: 3,
                }}
              >
                ₦{Number(item.price).toLocaleString("en-NG")}
              </AppText>
            ) : null}
          </View>

          <MaterialIcons
            name="chevron-right"
            size={22}
            color={colors.onSurfaceVariant}
            style={{ marginLeft: 4 }}
          />
        </View>
      </AppCard>
    );
  };

  const filterChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
      }}
      style={{ flexShrink: 0}}
    >
      {FILTERS.map((f) => {
        const active = filter === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              marginTop: spacing.sm,
              height: 32,
              borderRadius: 20,
              backgroundColor: active ? colors.primary : "transparent",
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.outline,
            }}
          >
            <AppText
              variant="bodySmall"
              style={{
                color: active ? colors.onPrimary : colors.onSurfaceVariant,
                fontWeight: active ? "700" : "400",
              }}
            >
              {f.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <ScreenWrapper showBack title="My Bookings" scrollable={false} padding={0}>
      {/* Filter chips */}
      {filterChips}

      {/* Content */}
      {loading ? (
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.xxl,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadJobs(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-long"
              title="No bookings yet"
              subtitle={
                filter
                  ? `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} bookings.`
                  : "Your bookings will appear here after your first service."
              }
              actionLabel={!filter ? "Book a Service" : undefined}
              onAction={
                !filter ? () => navigation.navigate("Clean") : undefined
              }
            />
          }
        />
      )}
    </ScreenWrapper>
  );
}
