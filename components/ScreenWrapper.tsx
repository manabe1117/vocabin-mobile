import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenWrapperProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  bottomPadding?: number; // カスタムの下部パディング（指定しない場合は自動）
}

/**
 * 画面全体をラップする共通コンポーネント
 * セーフエリア（3ボタンナビゲーション対応）を自動的に適用
 */
export function ScreenWrapper({ 
  children, 
  scrollable = true, 
  style,
  contentContainerStyle,
  bottomPadding,
  ...scrollViewProps
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  
  // 下部パディングを計算（指定がない場合は20pxをデフォルトに）
  const calculatedBottomPadding = bottomPadding !== undefined 
    ? Math.max(insets.bottom, bottomPadding)
    : Math.max(insets.bottom, 20);

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={[
          { paddingBottom: calculatedBottomPadding },
          contentContainerStyle
        ]}
        showsVerticalScrollIndicator={false}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: calculatedBottomPadding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});


