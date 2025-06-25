import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS } from '../../constants/styles';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  type = 'primary',
  size = 'medium',
  style,
  textStyle,
  children,
}) => {
  const getButtonStyle = () => {
    const baseStyle: ViewStyle[] = [styles.button, styles[size]];
    
    switch (type) {
      case 'primary':
        baseStyle.push(styles.primary);
        break;
      case 'secondary':
        baseStyle.push(styles.secondary);
        break;
      case 'success':
        baseStyle.push(styles.success);
        break;
      case 'error':
        baseStyle.push(styles.error);
        break;
      case 'warning':
        baseStyle.push(styles.warning);
        break;
    }
    
    if (disabled || loading) {
      baseStyle.push(styles.disabled);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle: TextStyle[] = [styles.text, styles[`${size}Text` as keyof typeof styles] as TextStyle];
    
    switch (type) {
      case 'primary':
        baseStyle.push(styles.primaryText);
        break;
      case 'secondary':
        baseStyle.push(styles.secondaryText);
        break;
      case 'success':
        baseStyle.push(styles.successText);
        break;
      case 'error':
        baseStyle.push(styles.errorText);
        break;
      case 'warning':
        baseStyle.push(styles.warningText);
        break;
    }
    
    if (disabled || loading) {
      baseStyle.push(styles.disabledText);
    }
    
    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style].flat()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'large' ? 'small' : 'small'}
          color={type === 'secondary' ? COLORS.PRIMARY : COLORS.WHITE}
        />
      ) : (
        <>
          {children || <Text style={[getTextStyle(), textStyle].flat()}>{title}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // サイズ
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 36,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
  },
  
  // タイプ
  primary: {
    backgroundColor: COLORS.PRIMARY,
  },
  secondary: {
    backgroundColor: COLORS.BACKGROUND.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
  },
  success: {
    backgroundColor: COLORS.SUCCESS.DEFAULT,
  },
  error: {
    backgroundColor: COLORS.ERROR.DEFAULT,
  },
  warning: {
    backgroundColor: COLORS.WARNING.DEFAULT,
  },
  disabled: {
    backgroundColor: COLORS.BACKGROUND.GRAY,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // テキストスタイル
  text: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  
  // テキストカラー
  primaryText: {
    color: COLORS.WHITE,
  },
  secondaryText: {
    color: COLORS.TEXT.PRIMARY,
  },
  successText: {
    color: COLORS.WHITE,
  },
  errorText: {
    color: COLORS.WHITE,
  },
  warningText: {
    color: COLORS.WHITE,
  },
  disabledText: {
    color: COLORS.TEXT.DISABLED,
  },
}); 