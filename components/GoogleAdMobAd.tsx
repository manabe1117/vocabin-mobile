import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { ThemedText } from './ThemedText';

/**
 * Google AdMob広告コンポーネント
 * モバイルアプリ向けのGoogle AdMob広告を表示します
 */
interface GoogleAdMobAdProps {
  adUnitId?: string; // ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx
  adFormat?: 'banner' | 'largeBanner' | 'mediumRectangle' | 'fullBanner' | 'leaderboard';
  testMode?: boolean;
}

export function GoogleAdMobAd({
  adUnitId = TestIds.BANNER, // デフォルトはテスト用ID
  adFormat = 'banner',
  testMode = false, // デフォルトを本番モードに変更
}: GoogleAdMobAdProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // AdMobのサイズ設定
  const getAdMobSize = () => {
    switch (adFormat) {
      case 'largeBanner':
        return BannerAdSize.LARGE_BANNER;
      case 'mediumRectangle':
        return BannerAdSize.MEDIUM_RECTANGLE;
      case 'fullBanner':
        return BannerAdSize.FULL_BANNER;
      case 'leaderboard':
        return BannerAdSize.LEADERBOARD;
      default: // banner
        return BannerAdSize.BANNER;
    }
  };

  const adSize = getAdMobSize();

  // 実際の広告ID（テストモードの場合はテスト用IDを使用）
  const actualAdUnitId = testMode ? TestIds.BANNER : adUnitId;

  const handleAdLoaded = () => {
    setIsLoading(false);
    console.log('AdMob Ad loaded:', adFormat, testMode ? '- Test Mode' : '- Production Mode');
  };

  const handleAdError = (error: any) => {
    setHasError(true);
    setIsLoading(false);
    console.error('AdMob Ad error:', error);
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4285F4" />
          <ThemedText style={styles.loadingText}>広告を読み込み中...</ThemedText>
        </View>
      )}
      
      {hasError && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>広告の読み込みに失敗しました</ThemedText>
        </View>
      )}

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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#c62828',
    textAlign: 'center',
  },
}); 