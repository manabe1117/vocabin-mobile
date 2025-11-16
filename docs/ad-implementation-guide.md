# 広告実装ガイド

このドキュメントは、Google AdMob 広告システムの設定と使用方法を説明します。

## 📍 現在の進捗

✅ **完了した実装:**
- AdMobライブラリ: `react-native-google-mobile-ads` 
- AdMobアプリID: `ca-app-pub-9940045330193360~7390502834`
- 設定ファイル: `config/admob.ts` (作成済み、改善済み)
- AdMob初期化関数: `initializeAdMob()` (作成済み)
- アプリ起動時の初期化: `app/_layout.tsx` に追加済み ✅
- ホーム画面: 広告実装済み ✅
- 翻訳画面: 広告実装済み ✅
- 辞書画面: 広告実装済み ✅
- 学習画面: 広告実装済み ✅

## 🚀 広告の追加手順

### 1️⃣ 既存コンポーネントを使用

アプリには以下の広告コンポーネントが存在します:

**`components/GoogleAdMobAd.tsx`** - 推奨
- 複数のサイズに対応（banner, largeBanner, mediumRectangle など）
- ローディング状態・エラー状態を表示
- テストモード対応

**`components/AdBanner.tsx`** - シンプル版
- バナー広告のみ
- 最小限の実装

### 2️⃣ 画面に広告を追加する

#### **例: 翻訳画面に広告を追加**

```typescript
// 1. インポート追加
import { GoogleAdMobAd } from '../components/GoogleAdMobAd';
import { ADMOB_UNIT_IDS } from '../config/admob';

// 2. JSX に追加（画面の下部）
<View style={styles.adContainer}>
  <GoogleAdMobAd
    adUnitId={ADMOB_UNIT_IDS.TRANSLATE_BANNER}
    adFormat="banner"
    testMode={false}
  />
</View>

// 3. スタイル追加
adContainer: {
  marginTop: 16,
  marginBottom: 8,
  alignItems: 'center',
}
```

### 3️⃣ プロダクション用IDの設定

Google AdMob ダッシュボードから ID を取得し、`config/admob.ts` を編集:

```typescript
// YOUR_PRODUCTION_HOME_BANNER_ID などを実際のIDに置き換え
ADMOB_UNIT_IDS = {
  HOME_BANNER: 'ca-app-pub-xxxxxxx/yyyyyyy',
  // ...
}
```

## 🎯 対応画面

| 画面 | 状態 | ユニットID |
|------|------|-----------|
| ホーム | ✅ 完了 | HOME_BANNER |
| 翻訳 | ⏳ TODO | TRANSLATE_BANNER |
| 辞書 | ⏳ TODO | DICTIONARY_BANNER |
| 学習 | ⏳ TODO | STUDY_BANNER |

## 📝 使用可能な広告タイプ

```typescript
// バナー広告（推奨）
<GoogleAdMobAd
  adUnitId={ADMOB_UNIT_IDS.BANNER}
  adFormat="banner"  // 標準: 320x50
/>

// 大きなバナー
adFormat="largeBanner"  // 320x100

// 中サイズ矩形
adFormat="mediumRectangle"  // 300x250

// フルバナー
adFormat="fullBanner"  // 468x60

// リーダーボード（横長）
adFormat="leaderboard"  // 728x90
```

## 🧪 テストモードの使用

開発中は自動的にテスト用IDが使用されます（`__DEV__` フラグで判定）:

```typescript
// config/admob.ts
const isDevelopment = __DEV__;

ADMOB_UNIT_IDS = {
  HOME_BANNER: isDevelopment
    ? 'ca-app-pub-3940256099942544/6300978111'  // ← テスト用ID
    : 'YOUR_PRODUCTION_ID',  // リリース時に実IDに変更
}
```

### テスト用ID の特性
- ✅ 開発中に何度もクリック可能
- ✅ 自分のデバイスでも不正判定されない
- ✅ 収益にカウントされない（安全）

## 📱 テストデバイスの登録

**重要**: 本番IDでテストする場合は、必ずテストデバイスを登録してください。

```typescript
// config/admob.ts
export const TEST_DEVICE_IDS = [
  '33BE8D0405244E8D83D03EBB92011234',  // Android デバイスID
  '12345678-1234-1234-1234-123456789012',  // iOS デバイスID
];
```

デバイスIDの取得方法:
- **Android**: `adb shell getprop ro.serialno`
- **iOS**: 設定 → 一般 → 情報 → デバイスID

📖 詳細は [テストデバイス設定ガイド](./test-device-setup.md) を参照

## 🚀 本番環境への移行

リリース前に必ず以下を実行してください:

```typescript
// config/admob.ts

// ✅ 本番用IDに変更
ADMOB_UNIT_IDS = {
  HOME_BANNER: 'ca-app-pub-xxxxxxx/yyyyyyy',  // 実際のID
  // ...
}

// ✅ テストデバイスをクリア
export const TEST_DEVICE_IDS = [
  // 空のままにする
];
```

📖 詳細は [本番環境設定ガイド](./production-ads-setup.md) を参照

## ⚠️ 重要な注意事項

### ❌ 絶対にやってはいけないこと

1. **テスト用IDでリリースする**
   - 収益が 0 円のままになる
   - Google が不審な活動と判定する可能性

2. **本番環境で自分で広告をクリックする**
   - 不正クリックと判定される
   - アカウントが停止される可能性

3. **テストデバイスを登録せずに本番IDでテストする**
   - 自分のクリックが収益にカウントされてしまう

### ✅ 正しい運用方法

1. **開発中**: テスト用ID + テストデバイス登録
2. **リリース前**: 本番用ID に変更 + テストデバイス クリア
3. **リリース後**: AdMob ダッシュボードで監視 + 自分でテストしない

## 🔗 参考資料

- [Google AdMob ドキュメント](https://admob.google.com/intl/ja/home/)
- [react-native-google-mobile-ads](https://react-native-google-mobile-ads.invertase.io/)
- [テストデバイス設定ガイド](./test-device-setup.md)
- [本番環境設定ガイド](./production-ads-setup.md)

