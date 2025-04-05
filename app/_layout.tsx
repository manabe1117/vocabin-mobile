// app/_layout.tsx
import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';

function TabLayout() {
  const colorScheme = useColorScheme();
  const { session } = useAuth();

  // ログインしていない場合はログイン画面にリダイレクト
  if (!session) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
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
      <Tabs.Screen
        name="account"
        options={{
          title: 'アカウント',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="auth/login"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <TabLayout />
    </AuthProvider>
  );
}