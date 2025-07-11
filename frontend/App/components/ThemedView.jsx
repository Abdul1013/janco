import React from 'react';
import { useThemeColor } from '../hooks/useThemeColor';

export function ThemedView({ style = {}, lightColor, darkColor, ...otherProps }) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return (
    <div
      style={{ backgroundColor, ...style }}
      {...otherProps}
    />
  );
}
