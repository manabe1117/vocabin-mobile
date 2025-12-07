import React, { useState } from "react";
import { View, StyleSheet, Dimensions, ActivityIndicator } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { ThemedText } from "./ThemedText";

/**
 * Google AdMob広告コンポーネント
 * モバイルアプリ向けのGoogle AdMob広告を表示します
 */
interface GoogleAdMobAdProps {
  adUnitId?: string; // ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx
  adFormat?:
    | "banner"
    | "largeBanner"
    | "mediumRectangle"
    | "fullBanner"
    | "leaderboard"
    | "anchoredAdaptive";
  testMode?: boolean;
}

export function GoogleAdMobAd({
  adUnitId = TestIds.BANNER, // デフォルトはテスト用ID
  adFormat = "banner",
  testMode = false, // デフォルトを本番モードに変更
}: GoogleAdMobAdProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // AdMobのサイズ設定
  const getAdMobSize = () => {
    switch (adFormat) {
      case "largeBanner":
        return BannerAdSize.LARGE_BANNER;
      case "mediumRectangle":
        return BannerAdSize.MEDIUM_RECTANGLE;
      case "fullBanner":
        return BannerAdSize.FULL_BANNER;
      case "leaderboard":
        return BannerAdSize.LEADERBOARD;
      case "anchoredAdaptive":
        return BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
      default: // banner
        return BannerAdSize.BANNER;
    }
  };

  const adSize = getAdMobSize();

  // 実際の広告ID（テストモードの場合はテスト用IDを使用）
  const actualAdUnitId = testMode ? TestIds.BANNER : adUnitId;

  const handleAdLoaded = () => {
    setIsLoading(false);
    console.log(
      "AdMob Ad loaded:",
      adFormat,
      testMode ? "- Test Mode" : "- Production Mode"
    );
  };

  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleAdError = (error: any) => {
    setHasError(true);
    setIsLoading(false);
    const errorCode = error?.code || "unknown";
    const errorMsg = error?.message || "Unknown error";
    setErrorMessage(`${errorCode}: ${errorMsg}`);
    console.error("AdMob Ad error:", {
      code: errorCode,
      message: errorMsg,
      adUnitId: actualAdUnitId,
      adFormat,
      fullError: error,
    });
  };

  return (
    <View style={styles.container}>
      {/* ローディング・エラー時は何も表示しない */}

      <BannerAd
        unitId={actualAdUnitId}
        size={adSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={handleAdLoaded}
        onAdFailedToLoad={handleAdError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    // paddingVertical: 10, // 余白を削除
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: "#ffebee",
    borderRadius: 8,
    marginHorizontal: 16,
  },
  errorText: {
    fontSize: 12,
    color: "#c62828",
    textAlign: "center",
  },
  errorDetail: {
    fontSize: 10,
    color: "#c62828",
    textAlign: "center",
    marginTop: 4,
    opacity: 0.7,
  },
});
