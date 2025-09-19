import React from 'react';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenTopSpacerProps = {
  extra?: number;
  includeInset?: boolean;
  color?: string;
};

export const ScreenTopSpacer: React.FC<ScreenTopSpacerProps> = ({
  extra = 0,
  includeInset = Platform.OS === 'android',
  color = 'transparent',
}) => {
  const insets = useSafeAreaInsets();
  const base = includeInset ? insets.top : 0;
  const height = Math.max(0, base + extra);
  if (height === 0) return null;
  return <View style={{ height, backgroundColor: color }} />;
};


