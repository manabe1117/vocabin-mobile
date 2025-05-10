// app/_layout.tsx

import React, { useEffect, useState } from 'react';
import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// スプラッシュスクリーンが自動で隠れるのを防ぐ
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false); // ナビゲーションを一度実行したか

  // --- 1. ナビゲーション準備完了を検知 ---
  // このコンポーネント（と中のStack）がマウントされたら準備完了とする
  useEffect(() => {
    console.log("RootLayoutNav mounted, setting navigation ready.");
    setIsNavigationReady(true);
  }, []);

  // --- 2. 認証状態に基づいて画面遷移 ---
  useEffect(() => {
    // ナビゲーション未準備 or ローディング中は処理しない
    if (!isNavigationReady || isLoading) {
        console.log(`Navigation/Auth not ready: isNavigationReady=${isNavigationReady}, isLoading=${isLoading}`);
        return;
    }

    // 既にナビゲーション処理を実行済みなら何もしない (ループ防止)
    if (hasNavigated) {
        console.log("Navigation already attempted, skipping.");
        SplashScreen.hideAsync(); // ローディング完了後、ナビゲーション試行済みならスプラッシュを隠す
        return;
    }

    const inAuthGroup = segments[0] === 'auth'; // 現在認証関連画面 (例: /auth/login) にいるか

    console.log(`Checking auth state: session=${session ? 'exists' : 'null'}, inAuthGroup=${inAuthGroup}`);

    if (!session && !inAuthGroup) {
      // セッションがなく、認証画面にもいない場合 -> ログイン画面へ
      console.log("Redirecting to /auth/login");
      router.replace('/auth/login');
      setHasNavigated(true); // ナビゲーション実行フラグを立てる
      SplashScreen.hideAsync(); // ナビゲーション後にスプラッシュを隠す
    } else if (session && inAuthGroup) {
      // セッションがあり、認証画面にいる場合 -> メイン画面 (tabs) へ
      console.log("Redirecting to main app (tabs)");
      router.replace('/(tabs)'); // (tabs) グループの初期画面へ
      setHasNavigated(true); // ナビゲーション実行フラグを立てる
      SplashScreen.hideAsync(); // ナビゲーション後にスプラッシュを隠す
    } else {
      // 上記以外 (セッションあり&メイン画面 or セッションなし&認証画面)
      // -> そのまま表示を続ける
      console.log("No redirect needed or already in correct group.");
      setHasNavigated(true); // ここでも「試行済み」とする
      SplashScreen.hideAsync(); // スプラッシュを隠す
    }

  // 依存配列: これらの値が変わったら再評価する
  }, [isNavigationReady, isLoading, session, segments, router, hasNavigated]);


  // --- 3. ナビゲーターのレンダリング ---
  // isNavigationReady が false の間も Stack をレンダリングする (重要！)
  // SplashScreen がこれを隠してくれる
  if (!isNavigationReady) {
      console.log("Navigation not ready yet, but rendering Stack anyway.");
      // 必要ならここに最小限のローディング表示を入れても良いが、Stackは必須
  }

  console.log("Rendering Stack Navigator.");
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* スクリーン定義 */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="dictionary" options={{ headerShown: true, title: '辞書' }} />
      <Stack.Screen name="translate" options={{ headerShown: true, title: '翻訳' }} />
      <Stack.Screen name="study" options={{ headerShown: true, title: '学習' }} />
      <Stack.Screen name="vocabulary" options={{ headerShown: true, title: '単語帳' }} />
      <Stack.Screen name="chat" options={{ headerShown: true, title: 'AIに質問' }} />
      <Stack.Screen name="auth/login" options={{ title: 'ログイン' }} />
    </Stack>
  );
}

// --- RootLayout: AuthProvider でラップ ---
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