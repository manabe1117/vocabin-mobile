import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/styles';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  margin?: number;
  elevation?: number;
  borderRadius?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 16,
  margin = 0,
  elevation = 3,
  borderRadius = 12,
}) => {
  return (
    <View
      style={[
        styles.card,
        {
          padding,
          margin,
          borderRadius,
          elevation,
          shadowRadius: elevation * 2,
          shadowOpacity: elevation * 0.05,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
}); 