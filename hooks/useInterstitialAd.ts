import { useState, useCallback, useRef, useEffect } from 'react';
import {
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';

/**
 * インタースティシャル広告（全画面広告）を管理するカスタムフック
 * ページ遷移時に全画面広告を表示するために使用
 */
export function useInterstitialAd(adUnitId: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isShowing, setIsShowing] = useState(false);

  // インスタンスをメモ化（毎回の再作成を防止）
  const interstitialAdRef = useRef<any>(null);

  // 広告インスタンスを1回だけ作成
  useEffect(() => {
    interstitialAdRef.current = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    console.log('🔧 InterstitialAd instance created for:', adUnitId);

    return () => {
      // クリーンアップ時にリスナーを削除
      interstitialAdRef.current = null;
    };
  }, [adUnitId]);

  // 広告イベントをセットアップ
  const setupAdListeners = useCallback(() => {
    if (!interstitialAdRef.current) return;

    const unsubscribeLoaded = interstitialAdRef.current.addAdEventListener(
      AdEventType.LOADED,
      () => {
        setIsLoaded(true);
        console.log('✅ Interstitial Ad loaded:', adUnitId);
      }
    );

    const unsubscribeClosed = interstitialAdRef.current.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        setIsShowing(false);
        setIsLoaded(false);
        console.log('❌ Interstitial Ad closed');
        // 広告を閉じた後、次の広告をロード
        setTimeout(() => {
          loadAd();
        }, 500);
      }
    );

    const unsubscribeError = interstitialAdRef.current.addAdEventListener(
      AdEventType.ERROR,
      (error: any) => {
        setIsLoaded(false);
        console.error('❌ Interstitial Ad error:', error);
      }
    );

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, [adUnitId]);

  // 広告をロード
  const loadAd = useCallback(async () => {
    try {
      if (!interstitialAdRef.current) {
        console.warn('InterstitialAd instance not initialized');
        return;
      }

      if (!isLoaded && !isShowing) {
        console.log('📥 Loading interstitial ad...');
        await interstitialAdRef.current.load();
        setupAdListeners();
      }
    } catch (error) {
      console.error('Failed to load interstitial ad:', error);
    }
  }, [isLoaded, isShowing, setupAdListeners]);

  // 広告を表示
  const showAd = useCallback(async () => {
    if (!interstitialAdRef.current) {
      console.warn('InterstitialAd instance not initialized');
      return;
    }

    if (isLoaded) {
      try {
        console.log('📺 Showing interstitial ad...');
        setIsShowing(true);
        await interstitialAdRef.current.show();
      } catch (error) {
        console.error('Failed to show interstitial ad:', error);
        setIsShowing(false);
      }
    } else {
      console.warn('Interstitial Ad is not loaded yet. Loading now...');
      // 広告がロードされていなければロード
      await loadAd();
    }
  }, [isLoaded, loadAd]);

  return {
    isLoaded,
    isShowing,
    loadAd,
    showAd,
  };
}

