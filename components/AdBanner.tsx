import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
// @ts-ignore - react-native-google-mobile-ads の型定義が見つからない場合の回避
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { ThemedText } from './ThemedText';

/**
 * 広告バナーコンポーネント
 * 実際のAdMob広告バナーを表示します
 */
interface AdBannerProps {
  bannerSize?: BannerAdSize;
}

export function AdBanner({ bannerSize = BannerAdSize.BANNER }: AdBannerProps) {
  // テスト用の広告ユニットID（実際のプロダクションでは変更が必要）
  const adUnitId = __DEV__ ? TestIds.BANNER : Platform.select({
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
    default: 'ca-app-pub-3940256099942544/6300978111',
  });

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>広告</ThemedText>
      <BannerAd
        unitId={adUnitId}
        size={bannerSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          console.log('Ad loaded successfully');
        }}
        onAdFailedToLoad={(error: any) => {
          console.error('Ad failed to load:', error);
        }}
        onAdOpened={() => {
          console.log('Ad opened');
        }}
        onAdClosed={() => {
          console.log('Ad closed');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
    padding: 5,
  },
  label: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 5,
  },
}); 