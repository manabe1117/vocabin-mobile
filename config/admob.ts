/**
 * AdMob 設定
 * Google AdMobのアプリIDと広告ユニットIDを管理します
 *
 * 重要: リリース前に本番用IDに置き換えてください！
 */

import { mobileAds } from "react-native-google-mobile-ads";

// AdMobアプリID（app.jsonから取得）
export const ADMOB_APP_ID = "ca-app-pub-9940045330193360~7390502834";

// 開発環境判定
export const isDevelopment = __DEV__;

// 広告ユニットID
// Google AdMobダッシュボードから取得し、ここに設定してください
export const ADMOB_UNIT_IDS = {
  // ホーム画面用バナー広告
  HOME_BANNER: isDevelopment
    ? "ca-app-pub-3940256099942544/6300978111" // テスト用ID（Android）
    : "ca-app-pub-9940045330193360/8835995188", // Vocabin_Home_Banner

  // 辞書画面用バナー広告
  DICTIONARY_BANNER: isDevelopment
    ? "ca-app-pub-3940256099942544/6300978111"
    : "YOUR_PRODUCTION_DICTIONARY_BANNER_ID",

  // 翻訳画面用バナー広告
  TRANSLATE_BANNER: isDevelopment
    ? "ca-app-pub-3940256099942544/6300978111"
    : "YOUR_PRODUCTION_TRANSLATE_BANNER_ID",

  // 学習画面用バナー広告
  STUDY_BANNER: isDevelopment
    ? "ca-app-pub-3940256099942544/6300978111"
    : "YOUR_PRODUCTION_STUDY_BANNER_ID",

  // インタースティシャル広告（全画面広告）- 共通用
  INTERSTITIAL: isDevelopment
    ? "ca-app-pub-3940256099942544/1033173712" // テスト用ID
    : "YOUR_PRODUCTION_INTERSTITIAL_ID",

  // 辞書画面用インタースティシャル広告
  DICTIONARY_INTERSTITIAL: isDevelopment
    ? "ca-app-pub-3940256099942544/1033173712" // テスト用ID（インタースティシャル形式）
    : "ca-app-pub-9940045330193360/3600046260", // Dictionary_Interstitial

  // 翻訳画面用インタースティシャル広告
  TRANSLATE_INTERSTITIAL: isDevelopment
    ? "ca-app-pub-3940256099942544/1033173712" // テスト用ID（インタースティシャル形式）
    : "YOUR_PRODUCTION_TRANSLATE_INTERSTITIAL_ID",

  // 学習画面用インタースティシャル広告
  STUDY_INTERSTITIAL: isDevelopment
    ? "ca-app-pub-3940256099942544/1033173712" // テスト用ID（インタースティシャル形式）
    : "ca-app-pub-9940045330193360/2286964599", // Study_Interstitial

  // リワード広告（報酬付き広告）
  REWARDED: isDevelopment
    ? "ca-app-pub-3940256099942544/5224354917" // テスト用ID
    : "YOUR_PRODUCTION_REWARDED_ID",
};

/**
 * テストデバイスの設定
 * 開発中はテストデバイスを登録して、テストデバイスからの
 * クリック/表示をカウント対象外にします
 *
 * テストデバイスIDの取得方法：
 * ① Android: adb shell getprop ro.serialno
 * ② iOS: 設定 → 一般 → 情報 → デバイスID
 *
 * 例:
 * TEST_DEVICE_IDS = [
 *   '33BE8D0405244E8D83D03EBB92011234',  // 開発者のAndroid
 *   '12345678-1234-1234-1234-123456789012',  // 開発者のiPhone
 * ];
 */
export const TEST_DEVICE_IDS = [
  // ご自身のテストデバイスIDをここに追加してください
  "EMULATOR35X4X9X0",
  "358158351587096",
];

/**
 * AdMob 初期化関数
 * アプリ起動時にこの関数を呼び出してください
 *
 * 使用例:
 * import { initializeAdMob } from '@/config/admob';
 *
 * // App.tsx または app/_layout.tsx で呼び出し
 * useEffect(() => {
 *   initializeAdMob();
 * }, []);
 */
export async function initializeAdMob() {
  try {
    // AdMob を初期化
    await mobileAds().initialize();

    // テストデバイスを登録（開発中のみ）
    if (isDevelopment && TEST_DEVICE_IDS.length > 0) {
      await mobileAds().setRequestConfiguration({
        testDeviceIdentifiers: TEST_DEVICE_IDS,
      });
      console.log(
        `✅ AdMob initialized. Test devices: ${TEST_DEVICE_IDS.length}`
      );
    } else {
      console.log("✅ AdMob initialized (production mode)");
    }
  } catch (error) {
    console.error("❌ Failed to initialize AdMob:", error);
  }
}
