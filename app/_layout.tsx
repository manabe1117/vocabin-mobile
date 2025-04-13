// app/_layout.tsx (修正後)

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
// ★ SplashScreen と ActivityIndicator をインポート
import { Tabs, Redirect, SplashScreen } from 'expo-router';
import { ActivityIndicator, View } from 'react-native'; // ActivityIndicator を追加

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '@/context/AuthContext'; // useAuth をインポート

// ★ アプリの準備が整うまでスプラッシュスクリーンを表示し続ける
SplashScreen.preventAutoHideAsync();

// ★ メインのレイアウト部分を定義 (以前の TabLayout や AppLayout に相当)
function MainLayout() {
  const { session, isLoading } = useAuth(); // ★ isLoading を取得
  const colorScheme = useColorScheme();

  useEffect(() => {
    // ★ ローディングが完了したらスプラッシュスクリーンを隠す
    if (!isLoading) {
      console.log("MainLayout: isLoading is false, hiding SplashScreen.");
      SplashScreen.hideAsync();
    } else {
      console.log("MainLayout: isLoading is true.");
    }
  }, [isLoading]); // isLoading の変化を監視

  // ★★★ ローディング中は何も表示しない (またはローディングインジケーター) ★★★
  if (isLoading) {
    // SplashScreenが表示されているので、nullを返すのが一般的
    // これにより、ナビゲーション要素がマウント前にレンダリングされるのを防ぐ
    console.log("MainLayout: Rendering null because isLoading is true.");
    return null;
    // または、インジケーターを表示したい場合:
    // return (
    //   <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme ?? 'light'].background }}>
    //     <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
    //   </View>
    // );
  }

  // ★ ローディング完了後: セッションがない場合はログイン画面へリダイレクト
  if (!session) {
    console.log("MainLayout: Rendering Redirect to /auth/login because session is null.");
    // リダイレクトはナビゲーションがマウントされた後に行われる
    return <Redirect href="/auth/login" />;
  }

  // ★ ローディング完了後: セッションがある場合はタブナビゲーションを表示
  console.log("MainLayout: Rendering Tabs because session exists.");
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}>
      {/* === 各タブスクリーンの定義 === */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'アカウント',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={28} color={color} />,
        }}
      />
      <Tabs.Screen name="auth/login" options={{ href: null }} />
      <Tabs.Screen name="translate" options={{ href: null }} />
      <Tabs.Screen name="study" options={{ href: null }} />
    </Tabs>
  );
}

// ★ ルートレイアウト (AuthProviderで全体をラップ)
export default function RootLayout() {
  console.log("RootLayout rendering. Wrapping with AuthProvider.");
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}