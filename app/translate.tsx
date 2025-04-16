import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Platform,
  Alert,
  Dimensions,
  TouchableWithoutFeedback,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { supabase } from '../lib/supabase';
import { useSpeech } from '../hooks/useSpeech';

/**
 * 音声データのインターフェース定義
 */
interface Voice {
  identifier: string; // 音声の一意な識別子
  language: string; // 音声の言語コード (例: 'en-US', 'ja-JP')
  name: string;     // 音声の名前 (例: 'Samantha', 'Kyoko')
}

/**
 * アプリケーション全体で使用する色の定義
 */
const colors = {
  background: '#f8f9fa',          // アプリ全体の背景色
  inputBackground: '#ffffff',     // 入力エリアの背景色
  outputBackground: '#ffffff',    // 出力エリアの背景色
  textPrimary: '#202124',         // 主要なテキストの色
  textSecondary: '#5f6368',       // 副次的なテキストやアイコンの色
  accentBlue: '#1a73e8',          // アクセントカラー（ボタンなど）
  iconColor: '#5f6368',           // 通常のアイコンの色
  iconColorDisabled: '#bdbdbd',   // 無効状態のアイコンの色
  borderColor: '#dadce0',         // ボーダーや区切り線の色
  rippleColor: 'rgba(0, 0, 0, 0.1)', // タッチエフェクトの色 (Android)
  errorColor: '#d93025',          // エラーメッセージの色
  placeholderColor: '#9e9e9e',    // プレースホルダーテキストの色
  bottomBarBackground: '#ffffff', // 下部バーの背景色
  langButtonBackgroundOriginal: '#e8f0fe', // 言語選択ボタンの背景色
};

/**
 * 共通で使用するスタイル定義
 */
const COMMON_STYLES: {
  loadingContainer: ViewStyle; // ローディングインジケーター表示用コンテナ
  errorContainer: ViewStyle;   // エラーメッセージ表示用コンテナ
  errorText: TextStyle;        // エラーメッセージのテキストスタイル
} = {
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
};


/**
 * 翻訳画面のメインコンポーネント
 */
const TranslateScreen = () => {
  // --- State定義 ---
  const [inputText, setInputText] = useState(''); // 入力されたテキスト
  const [translatedText, setTranslatedText] = useState(''); // 翻訳結果のテキスト
  const [sourceLang, setSourceLang] = useState('英語'); // 翻訳元の言語
  const [targetLang, setTargetLang] = useState('日本語'); // 翻訳先の言語
  const [isLoading, setIsLoading] = useState(false); // 翻訳処理中かどうかのフラグ
  const [error, setError] = useState<string | null>(null); // エラーメッセージ

  // --- Ref定義 ---
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null); // 入力デバウンス用のタイマーID
  const inputRef = useRef<TextInput>(null); // TextInputへの参照

  const { speakText } = useSpeech();

  /**
   * 表示用の言語名からGoogle Translate APIで使用する言語コードを取得する
   * @param lang 表示用の言語名 ('日本語', '英語')
   * @returns 言語コード ('ja', 'en')
   */
  const getLanguageCode = (lang: string): string => {
    switch (lang) {
      case '日本語':
        return 'ja';
      case '英語':
        return 'en';
      default:
        return 'en'; // デフォルトは英語
    }
  };

  /**
   * Google Cloud Translate APIを使用してテキストを翻訳する
   * @param textToTranslate 翻訳するテキスト
   */
  const handleTranslate = async (textToTranslate: string) => {
    const trimmedText = textToTranslate.trim(); // 前後の空白を除去

    // テキストが空の場合は翻訳せず、状態をリセット
    if (!trimmedText) {
      setTranslatedText('');
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true); // ローディング開始
    setError(null);     // エラーをリセット
    setTranslatedText(''); // 既存の翻訳結果をクリア

    try {
      // Supabase Edge Functionを呼び出し
      const { data, error } = await supabase.functions.invoke('translate', {
        body: {
          text: trimmedText,
          sourceLang: sourceLang,
          targetLang: targetLang,
        }
      });

      if (error) throw error;

      if (data && data.translatedText) {
        setTranslatedText(data.translatedText);
        setError(null);
      } else {
        throw new Error('翻訳結果が取得できませんでした。');
      }
    } catch (error) {
      console.error('Translation error:', error);
      setError('翻訳中にエラーが発生しました。');
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 翻訳元言語と翻訳先言語を入れ替える
   * 入力テキストと翻訳結果テキストも入れ替える（翻訳結果がある場合）
   */
  const swapLanguages = () => {
    // ローディング中は処理しない
    if (isLoading) return;

    const currentSource = sourceLang;
    const currentTarget = targetLang;
    const currentInput = inputText;
    const currentOutput = translatedText;

    // 言語を入れ替え
    setSourceLang(currentTarget);
    setTargetLang(currentSource);

    // 有効な翻訳結果がある場合、それを入力テキストに設定
    // それ以外の場合、翻訳結果とエラーをクリア
    if (currentOutput.trim() && !isLoading && !error) {
      setInputText(currentOutput);
      // setTranslatedText(''); // targetLangが変わるのでuseEffectで再翻訳される
    } else {
        // 入力が空でもともと出力も空だった場合、またはエラーがあった場合など
        setInputText(currentInput); // 元の入力を維持する
        setTranslatedText('');
        setError(null);
        // 入力が空でなければuseEffectで再翻訳がトリガーされる
        // 入力が空なら翻訳結果は空のまま
    }
  };


  /**
   * 入力テキスト、翻訳結果、エラーメッセージをクリアし、入力フィールドにフォーカスする
   */
  const clearInput = () => {
    setInputText('');
    setTranslatedText('');
    setError(null);
    // デバウンス中のタイマーがあればクリア
    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
    }
    setIsLoading(false); // ローディング状態もリセット
    inputRef.current?.focus(); // TextInputにフォーカスを当てる
  };

  /**
   * 指定されたテキストをクリップボードにコピーする
   * @param text コピーするテキスト
   */
  const copyToClipboard = async (text: string) => {
    if (!text) return; // テキストが空なら何もしない
    try {
        await Clipboard.setStringAsync(text); // クリップボードにコピー
        Alert.alert('コピー完了', '翻訳結果をクリップボードにコピーしました。');
    } catch (e) {
        console.error('Clipboard copy error:', e);
        Alert.alert('エラー', 'クリップボードへのコピーに失敗しました。');
    }
  };

  /**
   * inputTextまたはtargetLangが変更されたときにデバウンス処理を挟んで翻訳を実行するuseEffect
   */
  useEffect(() => {
    // 既存のデバウンスタイマーがあればクリア
    if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); }

    const textToTranslate = inputText;

    // 入力テキストが空、または空白のみの場合は翻訳せず状態をリセット
    if (!textToTranslate.trim()) {
        setTranslatedText('');
        setError(null);
        setIsLoading(false);
        return; // 翻訳処理は行わない
    }

    // 新しいデバウンスタイマーを設定 (800ms後に翻訳を実行)
    debounceTimeout.current = setTimeout(() => {
        handleTranslate(textToTranslate);
    }, 800);

    // クリーンアップ関数: コンポーネントのアンマウント時や依存配列の変更前にタイマーをクリア
    return () => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
    };
  }, [inputText, targetLang]); // inputText または targetLang が変更されたら実行

  /**
   * マイク入力ボタンが押されたときの処理（現在は未実装のアラート表示）
   */
  const handleMicInput = () => { Alert.alert("未実装", "音声入力機能は現在開発中です。"); };

  /**
   * カメラ入力ボタンが押されたときの処理（現在は未実装のアラート表示）
   */
  const handleCameraInput = () => { Alert.alert("未実装", "カメラ入力機能は現在開発中です。"); };

  // --- JSXレンダリング ---
  return (
    // 画面全体を TouchableWithoutFeedback で囲み、キーボード外タップでキーボードを閉じる
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ThemedView style={styles.container}>

        {/* --- 入力エリア --- */}
        <View style={styles.inputArea}>
          {/* 入力テキスト表示用ScrollView */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled" // スクロールビュー内のタップイベントをハンドリング
          >
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              multiline // 複数行入力許可
              placeholder={sourceLang === '英語' ? "Enter text" : "テキストを入力"}
              placeholderTextColor={colors.placeholderColor}
              value={inputText}
              onChangeText={setInputText} // テキスト変更時にinputText Stateを更新
              textAlignVertical="top" // Androidでテキストを上揃えにする
              scrollEnabled={false} // TextInput自体のスクロールは無効化 (ScrollViewで制御)
            />
          </ScrollView>
          {/* 入力エリアのアクションボタン (クリア、読み上げ) */}
          <View style={styles.inputActionsContainer}>
            {/* 入力テキストがある場合のみ表示 */}
            {inputText.length > 0 ? (
                <React.Fragment>
                    {/* 読み上げボタン */}
                    <TouchableOpacity
                        onPress={() => speakText(inputText, sourceLang)}
                        style={styles.iconButton}
                        disabled={!inputText} // テキストがない場合は無効
                        >
                        <Ionicons name="volume-high-outline" size={24} color={!inputText ? colors.iconColorDisabled : colors.iconColor} />
                    </TouchableOpacity>
                    {/* スペーサー */}
                    <View style={{flex: 1}} />
                    {/* クリアボタン */}
                    <TouchableOpacity onPress={clearInput} style={styles.iconButton}>
                        <Ionicons name="close-circle" size={24} color={colors.iconColor} />
                    </TouchableOpacity>
                </React.Fragment>
            ) : <View style={{ height: 40 }}/> /* ボタンがない場合も高さを確保 */ }
          </View>
        </View>

        {/* --- 区切り線 --- */}
        <View style={styles.divider} />

        {/* --- 出力エリア --- */}
        <View style={styles.outputArea}>
          {/* 翻訳先言語ラベル */}
          <View style={styles.outputLabelContainer}>
                <ThemedText style={styles.targetLanguageLabel}>{targetLang}</ThemedText>
           </View>
           {/* 翻訳結果表示エリア (ローディング、エラー、結果、プレースホルダーを条件分岐で表示) */}
            {isLoading ? (
              // ローディング表示
              <View style={COMMON_STYLES.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accentBlue} />
              </View>
            ) : error ? (
              // エラー表示
              <View style={COMMON_STYLES.errorContainer}>
                <Ionicons name="warning-outline" size={30} color={colors.textSecondary} />
                <ThemedText style={COMMON_STYLES.errorText}>{error}</ThemedText>
              </View>
            ) : translatedText ? (
              // 翻訳結果表示
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.outputText}>{translatedText}</ThemedText>
              </ScrollView>
            ) : (
              // プレースホルダー表示
              <View style={styles.placeholderContainer}>
                <ThemedText style={styles.placeholderText}>翻訳結果がここに表示されます</ThemedText>
              </View>
            )}
          {/* 出力エリアのアクションボタン (コピー、読み上げ) */}
          <View style={styles.outputActionsBottomContainer}>
            {/* 翻訳結果があり、ローディング中でなく、エラーもない場合に表示 */}
            {translatedText && !isLoading && !error ? (
                <React.Fragment>
                    {/* 読み上げボタン */}
                    <TouchableOpacity
                        onPress={() => speakText(translatedText, targetLang)}
                        style={styles.iconButton}
                    >
                        <Ionicons name="volume-high-outline" size={24} color={colors.iconColor} />
                    </TouchableOpacity>
                    {/* スペーサー */}
                    <View style={{flex: 1}} />
                    {/* コピーボタン */}
                    <TouchableOpacity
                        onPress={() => copyToClipboard(translatedText)}
                        style={styles.iconButton}
                    >
                        <Ionicons name="copy-outline" size={22} color={colors.iconColor} />
                    </TouchableOpacity>
                </React.Fragment>
            ) : <View style={{ height: 40 }}/> /* ボタンがない場合も高さを確保 */ }
          </View>
        </View>

        {/* --- 下部バー (言語切り替え、マイク、カメラ) --- */}
        <View style={styles.bottomBar}>
            {/* 翻訳元言語表示ボタン (現在は表示のみで操作不可) */}
            <TouchableOpacity style={styles.bottomLangButton} disabled>
                <ThemedText style={styles.bottomLangText}>{sourceLang}</ThemedText>
            </TouchableOpacity>
            {/* 言語入れ替えボタン */}
            <TouchableOpacity onPress={swapLanguages} style={styles.swapButton} disabled={isLoading}>
                <Ionicons name="swap-horizontal" size={24} color={isLoading ? colors.iconColorDisabled : colors.accentBlue} />
            </TouchableOpacity>
            {/* 翻訳先言語表示ボタン (現在は表示のみで操作不可) */}
            <TouchableOpacity style={styles.bottomLangButton} disabled>
                <ThemedText style={styles.bottomLangText}>{targetLang}</ThemedText>
            </TouchableOpacity>
            {/* 右寄せのためのスペーサー */}
             <View style={{ flex: 1 }} />
             {/* マイク入力ボタン */}
             <TouchableOpacity onPress={handleMicInput} style={styles.iconButtonMicCam}>
                <Ionicons name="mic-outline" size={28} color={colors.iconColor} />
            </TouchableOpacity>
             {/* カメラ入力ボタン */}
             <TouchableOpacity onPress={handleCameraInput} style={[styles.iconButtonMicCam, { marginLeft: 12 }]}>
                <Ionicons name="camera-outline" size={28} color={colors.iconColor} />
            </TouchableOpacity>
        </View>

      </ThemedView>
    </TouchableWithoutFeedback>
  );
};

// --- スタイル定義 ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inputArea: {
    flex: 1, // 利用可能なスペースを占有
    backgroundColor: colors.inputBackground,
    paddingTop: Platform.OS === 'android' ? 10 : 20, // Android/iOSで上部パディング調整
    paddingHorizontal: 16,
    justifyContent: 'space-between', // TextInputとアクションボタンの間隔を調整
  },
  outputArea: {
    flex: 1, // 利用可能なスペースを占有
    backgroundColor: colors.outputBackground,
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderColor,
  },
  scrollView: {
    // ScrollView自体はflex: 1を持たない（コンテンツに応じて伸縮）
  },
  scrollContentContainer: {
    flexGrow: 1, // コンテンツが少ない場合でもコンテナの高さを埋める
    paddingBottom: 10, // スクロール終端の余白
  },
  textInput: {
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 30, // 行間
    minHeight: 80, // 最小の高さ
    paddingTop: Platform.OS === 'ios' ? 8 : 0, // iOSでの上部パディング調整
  },
  outputText: {
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 30,
    paddingVertical: 8, // 上下のパディング
  },
  // 入力エリアのアクションボタン（クリア、読み上げ）用コンテナ
  inputActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 5,
      height: 40, // 高さを固定
  },
  // 翻訳先言語ラベルのコンテナ
  outputLabelContainer: {
      minHeight: 30, // 最小の高さを確保
      justifyContent: 'center',
  },
  // 出力エリアのアクションボタン（コピー、読み上げ）用コンテナ
  outputActionsBottomContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 5,
      height: 40, // 高さを固定
  },
  // 翻訳先言語ラベルのテキストスタイル
  targetLanguageLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginLeft: 8,
  },
  // 汎用アイコンボタンスタイル
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  // 翻訳結果がない場合のプレースホルダーコンテナ
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
   // プレースホルダーテキストのスタイル
   placeholderText: {
      fontSize: 16,
      color: colors.placeholderColor,
      textAlign: 'center',
  },

  // 下部バーのスタイル
  bottomBar: {
    flexDirection: 'row', // 要素を横並びにする
    alignItems: 'center', // 要素を中央揃え（縦方向）にする
    paddingHorizontal: 10, // 左右のパディング
    paddingVertical: Platform.OS === 'ios' ? 10 : 8, // 上下のパディング (OS差考慮)
    paddingBottom: Platform.OS === 'ios' ? 20 : 8, // 下部のパディング (特にiOSのSafeArea考慮)
    borderTopWidth: 1, // 上部に境界線
    borderColor: colors.borderColor, // 境界線の色
    backgroundColor: colors.bottomBarBackground, // 背景色
    minHeight: 55, // 最小の高さ
  },
  // 下部バーの言語表示ボタンのスタイル
  bottomLangButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18, // 角丸
    backgroundColor: colors.langButtonBackgroundOriginal, // 背景色
    minWidth: 80, // 最小の幅
    alignItems: 'center', // テキストを中央揃え
    marginHorizontal: 5, // 左右のマージン
  },
  // 下部バーの言語表示テキストのスタイル
  bottomLangText: {
    fontSize: 14,
    fontWeight: '500', // やや太字
    color: colors.accentBlue, // テキストの色
  },
  // 言語入れ替えボタンのスタイル
  swapButton: {
    padding: 8, // タップ領域確保のためのパディング
  },
  // 下部バーのマイク・カメラアイコンボタンのスタイル
   iconButtonMicCam: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44, // ボタンの幅
    height: 44, // ボタンの高さ
    borderRadius: 22, // 円形にする
    marginLeft: 5, // 左側のマージン
   },
});

export default TranslateScreen;