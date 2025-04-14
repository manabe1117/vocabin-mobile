// app/_layout.tsx (修正後 - Stack Navigator)
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, SplashScreen, Redirect } from 'expo-router'; // ★ Stack をインポート
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!isLoading) {
      console.log("RootLayoutNav: isLoading is false, hiding SplashScreen.");
      SplashScreen.hideAsync();
    } else {
      console.log("RootLayoutNav: isLoading is true.");
    }
  }, [isLoading]);

  if (isLoading) {
    console.log("RootLayoutNav: Rendering null because isLoading is true.");
    return null;
    // またはインジケーター
    // return (
    //   <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme ?? 'light'].background }}>
    //     <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
    //   </View>
    // );
  }

  // ★ ローディング完了後: セッションがない場合はログイン画面へリダイレクト
  //    ログイン画面自体もStack Navigator管理下にあるため、リダイレクト先をログイン画面にする
  if (!session && !isLoading) {
    console.log("RootLayoutNav: Redirecting to /auth/login");
    return <Redirect href="/auth/login" />;
  }

  // ★ セッションがある場合、またはログイン画面自体を表示する場合にStack Navigatorを表示
  console.log("RootLayoutNav: Rendering Stack Navigator.");
  return (
    <Stack>
      {/* (tabs) グループを Stack のスクリーンとして定義 */}
      {/* このスクリーンにはヘッダーを表示しない */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* dictionary スクリーン */}
      <Stack.Screen
        name="dictionary"
        options={{
          title: '辞書', // ヘッダータイトル
          headerShown: true, // ヘッダーを表示 (戻るボタンが自動でつく)
          // headerBackTitle: 'ホーム', // iOS用に戻るボタンの隣のテキスト
          // headerTintColor: Colors[colorScheme ?? 'light'].text, // ヘッダーの色などカスタマイズ可能
          // headerStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background },
        }}
      />

      {/* translate スクリーン */}
      <Stack.Screen
        name="translate"
        options={{
          title: '翻訳', // ヘッダータイトル
          headerShown: true, // ヘッダーを表示 (戻るボタンが自動でつく)
          // headerBackTitle: 'ホーム', // iOS用に戻るボタンの隣のテキスト
          // headerTintColor: Colors[colorScheme ?? 'light'].text, // ヘッダーの色などカスタマイズ可能
          // headerStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background },
        }}
      />

      {/* study スクリーン */}
      <Stack.Screen
        name="study"
        options={{
          title: '学習', // ヘッダータイトル
          headerShown: true, // ヘッダーを表示
          // headerBackTitle: 'ホーム',
          // headerTintColor: Colors[colorScheme ?? 'light'].text,
          // headerStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background },
        }}
      />

      {/* ログイン画面 (Stack Navigatorの一部として管理) */}
      {/* ログイン状態でない場合、上のRedirectでここに飛ばされる */}
      <Stack.Screen
        name="auth/login"
        options={{
          title: 'ログイン',
          headerShown: false, // ログイン画面ではヘッダー不要な場合が多い
          // ログイン成功後に (tabs) へ replace するなどの処理が必要
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  console.log("RootLayout rendering. Wrapping with AuthProvider.");
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
