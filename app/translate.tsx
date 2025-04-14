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
// import { supabase } from '@/lib/supabase';
import { handleApiError } from '../utils/errorHandler';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';

interface Voice {
  identifier: string;
  language: string;
  name: string;
}

const colors = {
  background: '#f8f9fa',
  inputBackground: '#ffffff',
  outputBackground: '#ffffff',
  textPrimary: '#202124',
  textSecondary: '#5f6368',
  accentBlue: '#1a73e8',
  iconColor: '#5f6368',
  iconColorDisabled: '#bdbdbd',
  borderColor: '#dadce0',
  rippleColor: 'rgba(0, 0, 0, 0.1)',
  errorColor: '#d93025',
  placeholderColor: '#9e9e9e',
  bottomBarBackground: '#ffffff',
  // ★ 元の言語ボタン背景色を復活させるために定義しておく (もしcolorsオブジェクトになければ)
  langButtonBackgroundOriginal: '#e8f0fe',
};

const COMMON_STYLES: {
  loadingContainer: ViewStyle;
  errorContainer: ViewStyle;
  errorText: TextStyle;
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


const TranslateScreen = () => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('英語');
  const [targetLang, setTargetLang] = useState('日本語');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  // --- Functions (元のまま) ---
  const handleTranslate = async (textToTranslate: string) => {
    const trimmedText = textToTranslate.trim();
    if (!trimmedText) {
      setTranslatedText('');
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setTranslatedText('');
    setTimeout(() => {
      try {
        const dummyTranslatedText = `[${targetLang}に翻訳] ${trimmedText}`;
        setTranslatedText(dummyTranslatedText);
        setError(null);
      } catch (simulatedError) {
        setError('シミュレーション中に予期せぬエラーが発生しました。');
        setTranslatedText('');
      } finally {
        setIsLoading(false);
      }
    }, 1000);
  };

  const swapLanguages = () => {
    if (isLoading) return;
    const currentSource = sourceLang;
    const currentTarget = targetLang;
    const currentInput = inputText;
    const currentOutput = translatedText;
    setSourceLang(currentTarget);
    setTargetLang(currentSource);
    if (currentOutput.trim() && !isLoading && !error) {
      setInputText(currentOutput);
    } else {
        if (!currentInput.trim()) {
            setTranslatedText('');
            setError(null);
        } else {
             setTranslatedText('');
             setError(null);
        }
    }
  };


  const clearInput = () => {
    setInputText('');
    setTranslatedText('');
    setError(null);
    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
    }
    setIsLoading(false);
    inputRef.current?.focus();
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
        await Clipboard.setStringAsync(text);
        Alert.alert('コピー完了', '翻訳結果をクリップボードにコピーしました。');
    } catch (e) {
        Alert.alert('エラー', 'クリップボードへのコピーに失敗しました。');
    }
  };

   const speakText = async (text: string, lang: string) => {
    if (!text) return;
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
      return;
    }
    let languageCode = 'en-US';
    if (lang === '日本語') languageCode = 'ja-JP';
    else if (lang === '英語') languageCode = 'en-US';

    try {
        const availableVoices = await Speech.getAvailableVoicesAsync();
        let voiceIdentifier: string | undefined;
        if (Platform.OS === 'ios') {
            if (languageCode === 'ja-JP') voiceIdentifier = availableVoices.find((v: Voice) => v.language === languageCode && v.name === 'Kyoko')?.identifier;
            else if (languageCode === 'en-US') voiceIdentifier = availableVoices.find((v: Voice) => v.language === languageCode && v.name === 'Samantha')?.identifier;
        }
        if (!voiceIdentifier) voiceIdentifier = availableVoices.find((v: Voice) => v.language.startsWith(languageCode.split('-')[0]))?.identifier;
        Speech.speak(text, { language: languageCode, voice: voiceIdentifier });
    } catch (speechError) {
        Alert.alert("音声エラー", "テキストの読み上げ中にエラーが発生しました。");
    }
  };

  const handleMicInput = () => { Alert.alert("未実装", "音声入力機能は現在開発中です。"); };
  const handleCameraInput = () => { Alert.alert("未実装", "カメラ入力機能は現在開発中です。"); };

  // --- useEffect (元のまま) ---
  useEffect(() => {
    if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); }
    const textToTranslate = inputText;
    if (!textToTranslate.trim()) {
        setTranslatedText('');
        setError(null);
        setIsLoading(false);
        return;
    }
    debounceTimeout.current = setTimeout(() => { handleTranslate(textToTranslate); }, 800);
    return () => { if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); } };
  }, [inputText, targetLang]);


  // --- レンダリング (bottomBarの言語切り替え部分を元のスタイルに戻す) ---
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ThemedView style={styles.container}>

        {/* --- 入力エリア (元のまま) --- */}
        <View style={styles.inputArea}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              multiline
              placeholder={sourceLang === '英語' ? "Enter text" : "テキストを入力"}
              placeholderTextColor={colors.placeholderColor}
              value={inputText}
              onChangeText={setInputText}
              textAlignVertical="top"
              scrollEnabled={false}
            />
          </ScrollView>
          <View style={styles.inputActionsContainer}>
            {inputText.length > 0 ? (
                <React.Fragment>
                    <TouchableOpacity
                        onPress={() => speakText(inputText, sourceLang)}
                        style={styles.iconButton}
                        disabled={!inputText}
                        >
                        <Ionicons name="volume-high-outline" size={24} color={!inputText ? colors.iconColorDisabled : colors.iconColor} />
                    </TouchableOpacity>
                    <View style={{flex: 1}} />
                    <TouchableOpacity onPress={clearInput} style={styles.iconButton}>
                        <Ionicons name="close-circle" size={24} color={colors.iconColor} />
                    </TouchableOpacity>
                </React.Fragment>
            ) : <View style={{ height: 40 }}/> }
          </View>
        </View>

        {/* --- 区切り線 (元のまま) --- */}
        <View style={styles.divider} />

        {/* --- 出力エリア (元のまま) --- */}
        <View style={styles.outputArea}>
          <View style={styles.outputLabelContainer}>
                <ThemedText style={styles.targetLanguageLabel}>{targetLang}</ThemedText>
           </View>
            {isLoading ? (
              <View style={COMMON_STYLES.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accentBlue} />
              </View>
            ) : error ? (
              <View style={COMMON_STYLES.errorContainer}>
                <Ionicons name="warning-outline" size={30} color={colors.textSecondary} />
                <ThemedText style={COMMON_STYLES.errorText}>{error}</ThemedText>
              </View>
            ) : translatedText ? (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.outputText}>{translatedText}</ThemedText>
              </ScrollView>
            ) : (
              <View style={styles.placeholderContainer}>
                <ThemedText style={styles.placeholderText}>翻訳結果がここに表示されます</ThemedText>
              </View>
            )}
          <View style={styles.outputActionsBottomContainer}>
            {translatedText && !isLoading && !error ? (
                <React.Fragment>
                    <TouchableOpacity
                        onPress={() => speakText(translatedText, targetLang)}
                        style={styles.iconButton}
                    >
                        <Ionicons name="volume-high-outline" size={24} color={colors.iconColor} />
                    </TouchableOpacity>
                    <View style={{flex: 1}} />
                    <TouchableOpacity
                        onPress={() => copyToClipboard(translatedText)}
                        style={styles.iconButton}
                    >
                        <Ionicons name="copy-outline" size={22} color={colors.iconColor} />
                    </TouchableOpacity>
                </React.Fragment>
            ) : <View style={{ height: 40 }}/> }
          </View>
        </View>

        {/* --- 画面下部の固定バー (言語切り替え部分を元のスタイルに戻す) --- */}
        <View style={styles.bottomBar}>
            {/* ★ 元の言語ボタン (背景あり) */}
            <TouchableOpacity style={styles.bottomLangButton} disabled>
                <ThemedText style={styles.bottomLangText}>{sourceLang}</ThemedText>
            </TouchableOpacity>
            {/* ★ 元の入れ替えボタン */}
            <TouchableOpacity onPress={swapLanguages} style={styles.swapButton} disabled={isLoading}>
                <Ionicons name="swap-horizontal" size={24} color={isLoading ? colors.iconColorDisabled : colors.accentBlue} />
            </TouchableOpacity>
            {/* ★ 元の言語ボタン (背景あり) */}
            <TouchableOpacity style={styles.bottomLangButton} disabled>
                <ThemedText style={styles.bottomLangText}>{targetLang}</ThemedText>
            </TouchableOpacity>
            {/* ★ スペーサーを追加してアイコンを右に寄せる */}
             <View style={{ flex: 1 }} />
             {/* ★ マイク・カメラアイコン (サイズは大きいまま) */}
             <TouchableOpacity onPress={handleMicInput} style={styles.iconButtonMicCam}>
                <Ionicons name="mic-outline" size={28} color={colors.iconColor} />
            </TouchableOpacity>
             <TouchableOpacity onPress={handleCameraInput} style={[styles.iconButtonMicCam, { marginLeft: 12 }]}>
                <Ionicons name="camera-outline" size={28} color={colors.iconColor} />
            </TouchableOpacity>
        </View>

      </ThemedView>
    </TouchableWithoutFeedback>
  );
};

// --- スタイル定義 (bottomBar関連のスタイルを元に戻す) ---
const styles = StyleSheet.create({
  // --- 元のスタイル (変更なし) ---
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inputArea: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    paddingTop: Platform.OS === 'android' ? 10 : 20,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  outputArea: {
    flex: 1,
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
    // 元の通り flex: 1 なし
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  textInput: {
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 30,
    minHeight: 80,
    paddingTop: Platform.OS === 'ios' ? 8 : 0,
  },
  outputText: {
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 30,
    paddingVertical: 8,
  },
  inputActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 5,
      height: 40,
  },
  outputLabelContainer: {
      minHeight: 30,
      justifyContent: 'center',
  },
  outputActionsBottomContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 5,
      height: 40,
  },
  targetLanguageLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginLeft: 8,
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
   placeholderText: {
      fontSize: 16,
      color: colors.placeholderColor,
      textAlign: 'center',
  },

  // --- bottomBar 周辺のスタイル (言語切り替え部分を元に戻す) ---
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between', // 元のスタイルでは指定がなかったか、別の方法でレイアウトしていた
    paddingHorizontal: 10, // ★ 元のpaddingに戻す
    paddingVertical: Platform.OS === 'ios' ? 10 : 8, // ★ 元のpaddingに戻す
    paddingBottom: Platform.OS === 'ios' ? 20 : 8, // ★ 元のpaddingに戻す
    borderTopWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.bottomBarBackground,
    minHeight: 55, // ★ 元のminHeightに戻す
  },
  // ★ 言語ボタンのスタイルを元に戻す
  bottomLangButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.langButtonBackgroundOriginal, // ★ 元の背景色を使用
    minWidth: 80, // ★ 元のminWidth
    alignItems: 'center',
    marginHorizontal: 5, // ★ 元のmargin
  },
  // ★ 言語テキストのスタイルを元に戻す
  bottomLangText: {
    fontSize: 14, // ★ 元のfontSize
    fontWeight: '500', // ★ 元のfontWeight
    color: colors.accentBlue, // ★ 元のテキスト色
  },
  // ★ 入れ替えボタンのスタイルを元に戻す
  swapButton: {
    padding: 8,
    // marginHorizontal は bottomLangButton に含まれるので不要
  },
  // ★ マイク・カメラボタン (サイズは大きいまま、スタイル自体は変更なし)
   iconButtonMicCam: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44, // 大きいサイズを維持
    height: 44, // 大きいサイズを維持
    borderRadius: 22, // 大きいサイズを維持
    marginLeft: 5, // ★ 元のmarginLeftに戻す (スペーサーの代わり)
   },
   // ★ 以前の定義にはなかったスペーサーやコンテナを削除
   // bottomLangContainer: { ... },
   // bottomActionsContainer: { ... },
});

export default TranslateScreen;