// app/_layout.tsx
import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons'; // まとめてインポート
import { AuthProvider } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: true,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="home" size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="translate"
          options={{
            title: '翻訳',
            tabBarIcon: ({ color }) => <Ionicons name="language" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="study"
          options={{
            title: '学習',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="cards" size={28} color={color} />
            ),
          }}
        />
        {/* 以下を追加 */}
        <Tabs.Screen
          name="settings"
          options={{
            title: '設定',
            tabBarIcon: ({ color }) => (
              <FontAwesome5 name="cog" size={28} color={color} />
            ), // 適切なアイコンに変更
          }}
        />
      </Tabs>
    </AuthProvider>
  );
}