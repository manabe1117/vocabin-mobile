import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * 画面上部に表示するコンパクトなヘッダーのプロパティ
 * title: ヘッダー中央に表示するタイトル
 * onPressBack: 戻るボタン押下時のハンドラ（戻るボタンを表示したい時のみ指定）
 */
type CompactHeaderProps = {
  title?: string;
  onPressBack?: () => void;
};

export const CompactHeader: React.FC<CompactHeaderProps> = ({ title, onPressBack }) => {
  const showBack = typeof onPressBack === 'function';
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top : 0;

  return (
    <View
      style={{
        paddingTop: topPadding,
        height: 44 + topPadding,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: Platform.OS === 'ios' ? 0.5 : 1,
        borderBottomColor: '#e5e7eb',
      }}
    >
      {showBack ? (
        <TouchableOpacity
          onPress={onPressBack}
          activeOpacity={0.7}
          style={{
            position: 'absolute',
            left: Platform.OS === 'ios' ? 8 : 4,
            height: 44,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 44,
          }}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={Platform.OS === 'ios' ? '#007AFF' : 'black'}
          />
        </TouchableOpacity>
      ) : null}

      <Text
        numberOfLines={1}
        style={{
          fontSize: 16,
          fontWeight: Platform.OS === 'ios' ? '600' as const : '700' as const,
          color: '#111827',
          maxWidth: '70%',
        }}
      >
        {title ?? ''}
      </Text>
    </View>
  );
};


