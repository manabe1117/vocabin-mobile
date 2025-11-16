// app/_layout.tsx

import React, { useEffect, useState } from "react";
import { Stack, SplashScreen, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TopSafeArea } from "@/components/TopSafeArea";
import { CompactHeader } from "@/components/CompactHeader";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { initializeAdMob } from "@/config/admob";

// スプラッシュスクリーンが自動で隠れるのを防ぐ
SplashScreen.preventAutoHideAsync();

// AdMob の初期化
initializeAdMob().catch((error) =>
  console.error("AdMob initialization error:", error)
);

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
      console.log(
        `Navigation/Auth not ready: isNavigationReady=${isNavigationReady}, isLoading=${isLoading}`
      );
      return;
    }

    if (hasNavigated) {
      console.log("Navigation already attempted, skipping.");
      SplashScreen.hideAsync();
      return;
    }

    const inAuthGroup = segments[0] === "auth";

    console.log(
      `Checking auth state: session=${
        session ? "exists" : "null"
      }, inAuthGroup=${inAuthGroup}`
    );

    if (!session && !inAuthGroup) {
      console.log("Redirecting to /auth/login");
      router.replace("/auth/login");
      setHasNavigated(true);
      SplashScreen.hideAsync();
    } else if (session && inAuthGroup) {
      console.log("Redirecting to main app (tabs)");
      router.replace("/(tabs)");
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

  // すべてのサブページで上部インセットを無効化し、44dpのカスタムヘッダーに統一
  const commonHeaderOptions = {
    headerShown: true,
    headerTitleAlign: "center" as const,
    headerTopInsetEnabled: false,
  };

  const buildHeaderOptions = (title: string, back: boolean | "home") => ({
    ...commonHeaderOptions,
    title,
    // React Navigation の header 差し替え
    header: ({ navigation, options }: any) => (
      <CompactHeader
        title={(options?.title ?? title) as string}
        onPressBack={
          back
            ? back === "home"
              ? () => navigation.navigate("(tabs)")
              : () => navigation.goBack()
            : undefined
        }
      />
    ),
  });

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* スクリーン定義 */}
      <Stack.Screen name="(tabs)" />

      {/* Dictionary Screen - 辞書機能 */}
      {canAccessFeature("dictionary") && (
        <Stack.Screen
          name="dictionary"
          options={buildHeaderOptions("辞書", true)}
        />
      )}

      {/* Translate Screen - 翻訳機能 */}
      {canAccessFeature("translate") && (
        <Stack.Screen
          name="translate"
          options={buildHeaderOptions("翻訳", true)}
        />
      )}

      {/* Study Screen - 学習機能 */}
      {canAccessFeature("study") && (
        <Stack.Screen name="study" options={buildHeaderOptions("学習", true)} />
      )}

      {/* Vocabulary Screen - 単語帳機能 */}
      {canAccessFeature("vocabulary") && (
        <Stack.Screen
          name="vocabulary"
          options={buildHeaderOptions("単語帳", true)}
        />
      )}

      {/* Chat Screen - AIに質問機能 */}
      {canAccessFeature("chat") && (
        <Stack.Screen
          name="chat"
          options={buildHeaderOptions("AIに質問", "home")}
        />
      )}

      {/* Chat History Screen - チャット履歴機能 */}
      {canAccessFeature("chat-history") && (
        <Stack.Screen
          name="chat-history"
          options={buildHeaderOptions("チャット履歴", true)}
        />
      )}

      {/* Auth Screen - 認証画面 */}
      <Stack.Screen
        name="auth/login"
        options={buildHeaderOptions("ログイン", false)}
      />

      {/* Static Pages - 静的ページ */}
      <Stack.Screen
        name="about"
        options={buildHeaderOptions("アプリについて", true)}
      />
      <Stack.Screen
        name="help"
        options={buildHeaderOptions("ヘルプとサポート", true)}
      />
      <Stack.Screen
        name="inquiry"
        options={buildHeaderOptions("お問い合わせ", true)}
      />
      <Stack.Screen
        name="terms"
        options={buildHeaderOptions("利用規約", true)}
      />
      <Stack.Screen
        name="privacy"
        options={buildHeaderOptions("プライバシーポリシー", true)}
      />
    </Stack>
  );
}

// RootLayout: AuthProvider でラップ
export default function RootLayout() {
  console.log("RootLayout rendering. Wrapping with AuthProvider.");
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar
            style="dark"
            backgroundColor="#ffffff"
            translucent={false}
          />
          <TopSafeArea color="#ffffff" />
          <RootLayoutNav />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
