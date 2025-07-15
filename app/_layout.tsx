// app/_layout.tsx

import React, { useEffect, useState } from 'react';
import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TouchableOpacity, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// スプラッシュスクリーンが自動で隠れるのを防ぐ
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const { canAccessFeature } = useFeatureFlags();
  const router = useRouter();
  const segments = useSegments();
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  // ナビゲーション準備完了を検知
  useEffect(() => {
    console.log("RootLayoutNav mounted, setting navigation ready.");
    setIsNavigationReady(true);
  }, []);

  // 認証状態に基づいて画面遷移
  useEffect(() => {
    if (!isNavigationReady || isLoading) {
        console.log(`Navigation/Auth not ready: isNavigationReady=${isNavigationReady}, isLoading=${isLoading}`);
        return;
    }

    if (hasNavigated) {
        console.log("Navigation already attempted, skipping.");
        SplashScreen.hideAsync();
        return;
    }

    const inAuthGroup = segments[0] === 'auth';

    console.log(`Checking auth state: session=${session ? 'exists' : 'null'}, inAuthGroup=${inAuthGroup}`);

    if (!session && !inAuthGroup) {
      console.log("Redirecting to /auth/login");
      router.replace('/auth/login');
      setHasNavigated(true);
      SplashScreen.hideAsync();
    } else if (session && inAuthGroup) {
      console.log("Redirecting to main app (tabs)");
      router.replace('/(tabs)');
      setHasNavigated(true);
      SplashScreen.hideAsync();
    } else {
      console.log("No redirect needed or already in correct group.");
      setHasNavigated(true);
      SplashScreen.hideAsync();
    }

  }, [isNavigationReady, isLoading, session, segments, router, hasNavigated]);

  if (!isNavigationReady) {
      console.log("Navigation not ready yet, but rendering Stack anyway.");
  }

  console.log("Rendering Stack Navigator.");
  
  const createBackButton = () => (
    <View
      style={{
        marginLeft: Platform.OS === 'ios' ? 10 : 0, 
        padding: 12,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onTouchEnd={() => {
        router.back();
      }}
    >
      <Ionicons 
        name="arrow-back" 
        size={24} 
        color={Platform.OS === 'ios' ? '#007AFF' : 'black'} 
      />
    </View>
  );

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* スクリーン定義 */}
      <Stack.Screen name="(tabs)" />
      
      {/* Dictionary Screen - 辞書機能 */}
      {canAccessFeature('dictionary') && (
        <Stack.Screen 
          name="dictionary" 
          options={{
            headerShown: true, 
            title: '辞書',
            headerTitleAlign: 'center',
            headerLeft: createBackButton,
          }} 
        />
      )}
      
      {/* Translate Screen - 翻訳機能 */}
      {canAccessFeature('translate') && (
        <Stack.Screen 
          name="translate" 
          options={{
            headerShown: true, 
            title: '翻訳',
            headerTitleAlign: 'center',
            headerLeft: createBackButton,
          }} 
        />
      )}
      
      {/* Study Screen - 学習機能 */}
      {canAccessFeature('study') && (
        <Stack.Screen 
          name="study" 
          options={{
            headerShown: true, 
            title: '学習',
            headerTitleAlign: 'center',
            headerLeft: createBackButton,
          }} 
        />
      )}
      
      {/* Vocabulary Screen - 単語帳機能 */}
      {canAccessFeature('vocabulary') && (
        <Stack.Screen 
          name="vocabulary" 
          options={{
            headerShown: true, 
            title: '単語帳',
            headerTitleAlign: 'center',
            headerLeft: createBackButton,
          }} 
        />
      )}
      
      {/* Chat Screen - AIに質問機能 */}
      {canAccessFeature('chat') && (
        <Stack.Screen 
          name="chat" 
          options={{
            headerShown: true, 
            title: 'AIに質問',
            headerTitleAlign: 'center',
            headerLeft: createBackButton,
          }} 
        />
      )}
      
      {/* Chat History Screen - チャット履歴機能 */}
      {canAccessFeature('chat-history') && (
        <Stack.Screen 
          name="chat-history" 
          options={{
            headerShown: true, 
            title: 'チャット履歴',
            headerTitleAlign: 'center',
            headerLeft: createBackButton,
          }} 
        />
      )}
      
      {/* Auth Screen - 認証画面 */}
      <Stack.Screen 
        name="auth/login" 
        options={{ 
          title: 'ログイン', 
          headerShown: true,
          headerTitleAlign: 'center'
        }} 
      />
      
      {/* Static Pages - 静的ページ */}
      <Stack.Screen 
        name="about" 
        options={{
          headerShown: true, 
          title: 'アプリについて',
          headerTitleAlign: 'center',
          headerLeft: createBackButton,
        }} 
      />
      <Stack.Screen 
        name="help" 
        options={{
          headerShown: true, 
          title: 'ヘルプとサポート',
          headerTitleAlign: 'center',
          headerLeft: createBackButton,
        }} 
      />
      <Stack.Screen 
        name="inquiry" 
        options={{
          headerShown: true, 
          title: 'お問い合わせ',
          headerTitleAlign: 'center',
          headerLeft: createBackButton,
        }} 
      />
      <Stack.Screen 
        name="terms" 
        options={{
          headerShown: true, 
          title: '利用規約',
          headerTitleAlign: 'center',
          headerLeft: createBackButton,
        }} 
      />
      <Stack.Screen 
        name="privacy" 
        options={{
          headerShown: true, 
          title: 'プライバシーポリシー',
          headerTitleAlign: 'center',
          headerLeft: createBackButton,
        }} 
      />
    </Stack>
  );
}

// RootLayout: AuthProvider でラップ
export default function RootLayout() {
  console.log("RootLayout rendering. Wrapping with AuthProvider.");
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}