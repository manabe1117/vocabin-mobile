import React from 'react';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TopSafeAreaProps = {
  color?: string;
  extra?: number;
  visibleOnIOS?: boolean;
};

export const TopSafeArea: React.FC<TopSafeAreaProps> = ({
  color = '#ffffff',
  extra = 0,
  visibleOnIOS = false,
}) => {
  const insets = useSafeAreaInsets();
  const shouldRender = Platform.OS === 'android' || visibleOnIOS;
  if (!shouldRender) return null;

  return (
    <View
      style={{
        height: Math.max(0, insets.top + extra),
        backgroundColor: color,
      }}
    />
  );
};


