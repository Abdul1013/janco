import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, View } from "react-native";
import { ButtonStyles } from "../theme/Theme";

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  iconLeft,
  iconRight,
}) {
  const { buttonStyle, textStyle, contentStyle } = ButtonStyles(
    variant,
    size,
    disabled,
    fullWidth
  );

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textStyle.color} />
      ) : (
        <View style={contentStyle}>
                 {iconLeft  && <View style={{ marginRight: 6 }}>{iconLeft}</View>}
        <Text style={textStyle}> {title}</Text>
                    {iconRight && <View style={{ marginLeft: 6 }}>{iconRight}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}
