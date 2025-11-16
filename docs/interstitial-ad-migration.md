# インタースティシャル広告への移行ガイド

このドキュメントは、バナー広告からインタースティシャル広告（全画面広告）への移行について説明します。

## 📋 実装内容

### 変更対象画面
- ✅ **辞書ページ** (`app/dictionary.tsx`)
  - 単語検索時にインタースティシャル広告を表示
- ✅ **学習ページ** (`app/study.tsx`)
  - 学習完了時にインタースティシャル広告を表示
- ✅ **翻訳ページ** (`app/translate.tsx`)
  - 翻訳完了時にインタースティシャル広告を表示
- ℹ️ **ホームページ** (`app/(tabs)/index.tsx`)
  - バナー広告のまま（変更なし）

## 🔧 使用技術

### 新規ファイル
```
hooks/useInterstitialAd.ts
```

このカスタムフックはインタースティシャル広告の管理を簡素化します。

### カスタムフック: `useInterstitialAd`

```typescript
const { loadAd, showAd, isLoaded, isShowing } = useInterstitialAd(
  ADMOB_UNIT_IDS.DICTIONARY_BANNER
);
```

#### メソッド
- **`loadAd()`**: 広告をロード（ページ遷移時に自動的に呼び出し）
- **`showAd()`**: 広告を表示
- **`isLoaded`**: 広告がロード済みかどうか
- **`isShowing`**: 広告を表示中かどうか

## 📍 各ページの実装

### 1. 辞書ページ (`app/dictionary.tsx`)

**初期化**:
```typescript
const { loadAd, showAd } = useInterstitialAd(ADMOB_UNIT_IDS.DICTIONARY_BANNER);

useEffect(() => {
  loadAd();
}, [loadAd]);
```

**広告表示**:
```typescript
const handleTranslate = async () => {
  setIsDictionaryDetailsOpen(true);
  setDisplayText(inputText);
  await translate(inputText);
  // 翻訳後に広告を表示
  setTimeout(() => {
    showAd();
  }, 800);
};
```

トリガーポイント:
- 単語を検索時
- 提案をクリック時
- 翻訳結果をクリック時
- 検索履歴をクリック時

### 2. 学習ページ (`app/study.tsx`)

**初期化**:
```typescript
const { loadAd, showAd } = useInterstitialAd(ADMOB_UNIT_IDS.STUDY_BANNER);

useEffect(() => {
  loadAd();
}, [loadAd]);
```

**広告表示**:
```typescript
if (allCorrect) {
  setShowCompletionMessage(true);
  // 学習完了時に広告を表示
  setTimeout(() => {
    showAd();
  }, 500);
  return;
}
```

トリガーポイント:
- すべてのフラッシュカードを正解時（学習完了）

### 3. 翻訳ページ (`app/translate.tsx`)

**初期化**:
```typescript
const { loadAd, showAd } = useInterstitialAd(ADMOB_UNIT_IDS.TRANSLATE_BANNER);

useEffect(() => {
  loadAd();
}, [loadAd]);
```

**広告表示**:
```typescript
if (data && data.translatedText) {
  setTranslatedText(data.translatedText);
  setError(null);
  // 翻訳完了時に広告を表示
  setTimeout(() => {
    showAd();
  }, 800);
}
```

トリガーポイント:
- テキスト翻訳完了時

## 🎯 広告表示の流れ

```
ページ遷移
    ↓
useEffect で loadAd() 実行
    ↓
広告をバックグラウンドでロード
    ↓
ユーザーアクション（検索、翻訳など）
    ↓
showAd() で広告を表示
    ↓
ユーザーが広告を閉じる
    ↓
次の広告をロード（自動）
```

## 📊 設定情報

### 広告ユニットID

以下のIDが `config/admob.ts` で定義されています:

```typescript
ADMOB_UNIT_IDS = {
  DICTIONARY_BANNER: '...',  // 辞書画面用
  STUDY_BANNER: '...',       // 学習画面用
  TRANSLATE_BANNER: '...',   // 翻訳画面用
  INTERSTITIAL: '...',       // インタースティシャル用
}
```

### テストモード

開発中は自動的にテスト用IDが使用されます。

**テスト用インタースティシャルID**:
```
ca-app-pub-3940256099942544/1033173712
```

## 🚀 本番環境への対応

本番環境にデプロイする前に、以下を確認してください：

1. Google AdMob ダッシュボードから本番用のインタースティシャル広告ユニットを作成
2. `config/admob.ts` の `INTERSTITIAL` IDを本番IDに置き換え
3. 各画面で正しく広告が表示されることをテストデバイスで確認
4. テストデバイスを登録（`config/admob.ts` の `TEST_DEVICE_IDS`）

## 📝 除去した機能

以下のバナー広告は除去されました：

- ❌ `components/GoogleAdMobAd.tsx` の使用（辞書、学習、翻訳ページ）
- ❌ 各ページの `adContainer` スタイル定義
- ❌ 各ページの `GoogleAdMobAd` JSXコンポーネント

**ホームページのバナー広告は保持されたままです。**

## 🐛 トラブルシューティング

### 広告が表示されない
- AdMob初期化が完了しているか確認
- テストデバイスを登録したか確認
- インターネット接続を確認
- ログを確認: `console.log` で "Interstitial Ad loaded" のメッセージが表示されているか

### 広告がロードされない
- 広告ユニットIDが正しいか確認
- AdMob ダッシュボードで広告ユニットが有効になっているか確認
- 開発環境ではテスト用IDを使用しているか確認

### 広告が重複して表示される
- `loadAd()` や `showAd()` が複数回呼ばれていないか確認
- `useInterstitialAd` の依存配列を確認

## 📚 参考資料

- [Google AdMob Documentation](https://admob.google.com/home)
- [react-native-google-mobile-ads](https://react-native-google-mobile-ads.dev/)
- [Interstitial Ads Guide](https://react-native-google-mobile-ads.dev/docs/displaying-ads)

## ✅ チェックリスト

本番環境リリース前:

- [ ] すべての画面で広告がテストされた
- [ ] テスト用IDから本番IDに置き換えた
- [ ] テストデバイスが登録された
- [ ] ログが確認され、エラーがないことを確認
- [ ] AdMob ダッシュボードで収益が表示されていることを確認
- [ ] ユーザーが広告をスキップできることを確認

