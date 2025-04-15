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
  PermissionsAndroid, // Androidの権限リクエスト用
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
// import * as Speech from 'expo-speech'; // useSpeech フックで処理
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice'; // <-- インポート
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { supabase } from '../lib/supabase';
import { useSpeech } from '../hooks/useSpeech';

/**
 * 音声データのインターフェース定義 (Text-to-Speech用)
 */
interface VoiceData {
  identifier: string;
  language: string;
  name: string;
}

/**
 * アプリケーション全体で使用する色の定義
 */
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
  langButtonBackgroundOriginal: '#e8f0fe',
};

/**
 * 共通で使用するスタイル定義
 */
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

/**
 * 翻訳画面のメインコンポーネント
 */
const TranslateScreen = () => {
  // --- State定義 ---
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('英語');
  const [targetLang, setTargetLang] = useState('日本語');
  const [isLoading, setIsLoading] = useState(false); // 翻訳処理中
  const [error, setError] = useState<string | null>(null); // 翻訳エラー

  // --- 音声認識用 State ---
  const [isRecording, setIsRecording] = useState(false); // 音声認識中フラグ
  const [voiceError, setVoiceError] = useState<string | null>(null); // 音声認識エラー
  // const [partialResults, setPartialResults] = useState<string[]>([]); // 部分的な認識結果表示用 (任意)

  // --- Ref定義 ---
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);
  const isProcessingVoiceResult = useRef(false); // 認識結果の連続処理を防ぐフラグ

  const { speakText } = useSpeech();

  /**
   * 表示用の言語名から言語コードを取得する
   * @param lang 表示用の言語名 ('日本語', '英語')
   * @param type 'translate' (ja, en) または 'voice' (ja-JP, en-US)
   * @returns 言語コード
   */
  const getLanguageCode = (lang: string, type: 'translate' | 'voice' = 'translate'): string => {
    if (type === 'voice') {
      switch (lang) {
        case '日本語': return 'ja-JP';
        case '英語': return 'en-US';
        // 必要に応じて他の言語を追加
        default: return 'en-US';
      }
    } else { // type === 'translate'
      switch (lang) {
        case '日本語': return 'ja';
        case '英語': return 'en';
        // 必要に応じて他の言語を追加
        default: return 'en';
      }
    }
  };

  // --- 音声認識イベントハンドラー ---
  const onSpeechStart = (e: any) => {
    console.log('onSpeechStart: ', e);
    setIsRecording(true);
    setVoiceError(null); // 開始時にエラーをクリア
    setError(null); // 翻訳エラーもクリア
    // setPartialResults([]);
  };

  const onSpeechEnd = (e: any) => {
    console.log('onSpeechEnd: ', e);
    setIsRecording(false);
  };

  const onSpeechError = (e: SpeechErrorEvent) => {
    console.error('onSpeechError: ', e);
    let errorMessage = '音声認識中にエラーが発生しました。'; // デフォルトのエラーメッセージ

    // Optional Chaining を使用して安全に message を取得
    const message = e.error?.message;

    // message が存在する場合のみ、内容に基づいてメッセージを詳細化
    if (message) {
      if (message.includes('7') || message.toLowerCase().includes('no match')) { // "No match" エラーコード 7
        errorMessage = '音声を認識できませんでした。もう一度お試しください。';
      } else if (message.includes('6') || message.toLowerCase().includes('no speech')) { // "No speech input" エラーコード 6
        errorMessage = 'マイクが無効か、音声入力がありませんでした。設定を確認してください。';
      } else if (message.includes('network') || message.includes('Network')) { // ネットワーク関連エラー
        errorMessage = 'ネットワーク接続エラーが発生しました。接続を確認してください。';
      } else if (message.includes('permission') || message.includes('denied')) { // 権限関連エラー
        errorMessage = 'マイクへのアクセス許可がありません。設定アプリから許可してください。';
      } else if (message.includes('recognizer is busy')) { // 認識エンジンがビジー状態
        errorMessage = '音声認識エンジンが準備中です。少し待ってからもう一度お試しください。';
      } else {
        // 上記以外のエラーの場合、取得できたメッセージを表示
        errorMessage = `音声認識エラー: ${message}`;
      }
    } else if (e.error) {
        // message はないが、error オブジェクト自体は存在する場合（より具体的な情報がない）
        errorMessage = '不明な音声認識エラーが発生しました。';
    }
    // e.error も存在しない場合は、最初に設定したデフォルトメッセージが使用される

    setVoiceError(errorMessage);
    // Alert.alert('音声認識エラー', errorMessage); // 必要に応じてアラート表示
    setIsRecording(false); // エラー時は録音状態を解除
  };

  const onSpeechResults = (e: SpeechResultsEvent) => {
    console.log('onSpeechResults: ', e);
    if (e.value && e.value.length > 0 && !isProcessingVoiceResult.current) {
      isProcessingVoiceResult.current = true;
      const recognizedText = e.value[0];
      // 既存のテキストに追記する（必要に応じて置き換えに変更: setInputText(recognizedText)）
      setInputText(prev => prev ? `${prev.trim()} ${recognizedText}`.trim() : recognizedText);
      // 結果処理後にフラグを戻す（短い遅延で連続処理を防ぐ）
      setTimeout(() => { isProcessingVoiceResult.current = false; }, 100);
    }
  };

  // const onSpeechPartialResults = (e: SpeechResultsEvent) => {
  //   console.log('onSpeechPartialResults: ', e);
  //   setPartialResults(e.value || []);
  // };

  // --- 音声認識の開始/停止処理 ---
  const startRecognizing = async () => {
    if (isRecording) return;

    // Androidのマイク権限チェック
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'マイクの使用許可',
            message: '音声入力のためにマイクへのアクセスを許可してください。',
            buttonNeutral: '後で',
            buttonNegative: '許可しない',
            buttonPositive: '許可',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('権限エラー', 'マイクの使用が許可されていません。設定アプリから許可してください。');
          return;
        }
      } catch (err) {
        console.warn(err);
        Alert.alert('権限エラー', 'マイク権限の確認中にエラーが発生しました。');
        return;
      }
    }
    // iOSの場合は Info.plist で設定

    setVoiceError(null);
    setError(null);
    // setPartialResults([]);
    setInputText(''); // 音声入力開始時にテキストをクリア (任意)
    setTranslatedText('');
    Keyboard.dismiss();

    try {
      const locale = getLanguageCode(sourceLang, 'voice');
      await Voice.start(locale);
      // isRecording は onSpeechStart で true になる
    } catch (e) {
      console.error('Failed to start recognition', e);
      setVoiceError('音声認識を開始できませんでした。アプリを再起動するか、権限を確認してください。');
      setIsRecording(false);
    }
  };

  const stopRecognizing = async () => {
    if (!isRecording) return;
    try {
      await Voice.stop();
      // isRecording は onSpeechEnd で false になる
    } catch (e) {
      console.error('Failed to stop recognition', e);
      // エラーが発生しても録音状態は解除する
      setIsRecording(false);
      setVoiceError('音声認識の停止に失敗しました。');
    }
  };

  // マイクボタンの onPress ハンドラ
  const handleMicButtonPress = () => {
    if (isRecording) {
      stopRecognizing();
    } else {
      startRecognizing();
    }
  };

  // --- Voice ライブラリのリスナー設定 ---
  useEffect(() => {
    // リスナーを設定
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
    // Voice.onSpeechPartialResults = onSpeechPartialResults; // 必要なら

    // アンマウント時にリスナーを解除
    return () => {
      console.log('Removing voice listeners and destroying voice instance');
      // アプリ終了時などにリソースを解放
      Voice.destroy().then(Voice.removeAllListeners).catch(e => console.error("Error destroying voice instance:", e));
    };
  }, []); // 初回マウント時のみ実行

  /**
   * Google Cloud Translate APIを使用してテキストを翻訳する
   */
  const handleTranslate = async (textToTranslate: string) => {
    const trimmedText = textToTranslate.trim();

    if (!trimmedText || isRecording) { // 録音中は翻訳しない
      setTranslatedText('');
      setError(null);
      setIsLoading(false);
      return;
    }

    if (isProcessingVoiceResult.current) { // 音声結果処理中も翻訳を遅延させるかスキップ
        return;
    }

    setIsLoading(true);
    setError(null);
    setVoiceError(null); // 翻訳開始時に音声エラーはクリア
    setTranslatedText('');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('translate', {
        body: {
          text: trimmedText,
          sourceLang: getLanguageCode(sourceLang, 'translate'),
          targetLang: getLanguageCode(targetLang, 'translate'),
        }
      });

      if (invokeError) throw invokeError;

      if (data && data.translatedText) {
        setTranslatedText(data.translatedText);
        setError(null);
      } else {
        throw new Error(data?.error || '翻訳結果の形式が正しくありません。');
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      setError(error.message || '翻訳中にエラーが発生しました。');
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 翻訳元言語と翻訳先言語を入れ替える
   */
  const swapLanguages = () => {
    if (isLoading || isRecording) return; // 処理中、録音中は無視

    // 認識を停止
    if (isRecording) {
        stopRecognizing();
    }

    const currentSource = sourceLang;
    const currentTarget = targetLang;
    const currentInput = inputText;
    const currentOutput = translatedText;

    setSourceLang(currentTarget);
    setTargetLang(currentSource);

    // 有効な翻訳結果があれば入力に、なければ元の入力を維持
    if (currentOutput.trim() && !error) {
      setInputText(currentOutput);
    } else {
      setInputText(currentInput); // 元の入力テキストを保持
    }
    // 入れ替え後は翻訳結果をクリア (useEffectで再翻訳される)
    setTranslatedText('');
    setError(null);
    setVoiceError(null);
  };

  /**
   * 入力テキスト、翻訳結果、エラーメッセージをクリアする
   */
  const clearInput = () => {
    if (isRecording) {
      stopRecognizing(); // 録音中なら停止
    }
    setInputText('');
    setTranslatedText('');
    setError(null);
    setVoiceError(null);
    // setPartialResults([]);
    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
    }
    setIsLoading(false);
    inputRef.current?.focus();
  };

  /**
   * 指定されたテキストをクリップボードにコピーする
   */
  const copyToClipboard = async (text: string) => {
    if (!text || isRecording) return; // テキストがない or 録音中は何もしない
    try {
        await Clipboard.setStringAsync(text);
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
    if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); }

    const textToTranslate = inputText;

    // 録音中、または入力が空の場合は翻訳しない
    if (isRecording || !textToTranslate.trim()) {
        setTranslatedText('');
        setError(null);
        // isLoading は handleTranslate 内で制御されるのでここでは false にしない
        return;
    }

    debounceTimeout.current = setTimeout(() => {
      handleTranslate(textToTranslate);
    }, 800); // 800msのデバウンス

    // クリーンアップ
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [inputText, targetLang]); // isRecording を依存配列に含めない

  /**
   * カメラ入力ボタンが押されたときの処理（未実装）
   */
  const handleCameraInput = () => { Alert.alert("未実装", "カメラ入力機能は現在開発中です。"); };

  // --- レンダリング ---
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ThemedView style={styles.container}>

        {/* --- 入力エリア --- */}
        <View style={styles.inputArea}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* {isRecording && partialResults.length > 0 && ( // 部分結果表示 (任意)
              <ThemedText style={styles.partialText}>{partialResults.join(' ')}</ThemedText>
            )} */}
            <TextInput
              ref={inputRef}
              style={[styles.textInput, isRecording && styles.textInputRecording]} // 録音中のスタイル変更
              multiline
              placeholder={isRecording ? "音声を聞き取っています..." : (sourceLang === '英語' ? "Enter text" : "テキストを入力")}
              placeholderTextColor={colors.placeholderColor}
              value={inputText}
              onChangeText={setInputText}
              editable={!isRecording} // 録音中は編集不可
              textAlignVertical="top"
              scrollEnabled={false}
            />
          </ScrollView>
          <View style={styles.inputActionsContainer}>
            {(inputText.length > 0 || isRecording) ? (
                <React.Fragment>
                    {/* 読み上げボタン (録音中でなく、テキストがある場合) */}
                    {!isRecording && inputText.length > 0 ? (
                        <TouchableOpacity
                            onPress={() => speakText(inputText, getLanguageCode(sourceLang, 'voice'))}
                            style={styles.iconButton}
                            disabled={!inputText}
                            >
                            <Ionicons name="volume-high-outline" size={24} color={colors.iconColor} />
                        </TouchableOpacity>
                    ) : <View style={{ width: 40 }} />} {/* スペース確保 */}

                    <View style={{flex: 1}} />

                    {/* クリアボタン (録音中でなく、テキストがある場合) */}
                    {!isRecording && inputText.length > 0 ? (
                        <TouchableOpacity onPress={clearInput} style={styles.iconButton}>
                            <Ionicons name="close-circle" size={24} color={colors.iconColor} />
                        </TouchableOpacity>
                     ) : <View style={{ width: 40 }} />} {/* スペース確保 */}
                </React.Fragment>
            ) : <View style={{ height: 40 }}/> }
          </View>
        </View>

        <View style={styles.divider} />

        {/* --- 出力エリア --- */}
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
                <Ionicons name="warning-outline" size={30} color={colors.errorColor} />
                <ThemedText style={[COMMON_STYLES.errorText, { color: colors.errorColor }]}>{error}</ThemedText>
              </View>
            ) : voiceError ? ( // 音声認識エラー表示
              <View style={COMMON_STYLES.errorContainer}>
                <Ionicons name="mic-off-outline" size={30} color={colors.errorColor} />
                <ThemedText style={[COMMON_STYLES.errorText, { color: colors.errorColor }]}>{voiceError}</ThemedText>
              </View>
            ) : translatedText ? (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.outputText}>{translatedText}</ThemedText>
              </ScrollView>
            ) : isRecording ? ( // 録音中はインジケータを表示
                 <View style={styles.placeholderContainer}>
                    <ActivityIndicator size="small" color={colors.accentBlue} />
                   <ThemedText style={[styles.placeholderText, { marginTop: 10 }]}>認識中...</ThemedText>
                 </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <ThemedText style={styles.placeholderText}>翻訳結果がここに表示されます</ThemedText>
              </View>
            )}
          <View style={styles.outputActionsBottomContainer}>
            {/* 翻訳結果があり、エラーがなく、録音中でない場合にボタン表示 */}
            {translatedText && !isLoading && !error && !voiceError && !isRecording ? (
                <React.Fragment>
                    <TouchableOpacity
                        onPress={() => speakText(translatedText, getLanguageCode(targetLang, 'voice'))}
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

        {/* --- 下部バー --- */}
        <View style={styles.bottomBar}>
            {/* 言語選択ボタン (録音中は無効) */}
            <TouchableOpacity style={styles.bottomLangButton} disabled={isRecording}>
                <ThemedText style={styles.bottomLangText}>{sourceLang}</ThemedText>
            </TouchableOpacity>
            {/* 言語入れ替えボタン (処理中・録音中は無効) */}
            <TouchableOpacity onPress={swapLanguages} style={styles.swapButton} disabled={isLoading || isRecording}>
                <Ionicons name="swap-horizontal" size={24} color={isLoading || isRecording ? colors.iconColorDisabled : colors.accentBlue} />
            </TouchableOpacity>
             {/* 言語選択ボタン (録音中は無効) */}
            <TouchableOpacity style={styles.bottomLangButton} disabled={isRecording}>
                <ThemedText style={styles.bottomLangText}>{targetLang}</ThemedText>
            </TouchableOpacity>
             <View style={{ flex: 1 }} />
             {/* マイク入力ボタン */}
             <TouchableOpacity
                onPress={handleMicButtonPress}
                style={[styles.iconButtonMicCam, isRecording && styles.recordingButton]} // 録音中スタイル適用
             >
                <Ionicons
                    // 録音中は停止アイコン、そうでなければマイクアイコン
                    name={isRecording ? "stop-circle-outline" : "mic-outline"}
                    size={28}
                    // 録音中は赤、そうでなければ通常色
                    color={isRecording ? colors.errorColor : colors.iconColor}
                />
            </TouchableOpacity>
             {/* カメラ入力ボタン (録音中は無効) */}
             <TouchableOpacity onPress={handleCameraInput} style={[styles.iconButtonMicCam, { marginLeft: 12 }]} disabled={isRecording}>
                <Ionicons name="camera-outline" size={28} color={isRecording ? colors.iconColorDisabled : colors.iconColor} />
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
    // flex: 1 を持たない
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
  // 録音中のテキスト入力欄スタイル (任意)
  textInputRecording: {
    // backgroundColor: '#f0f0f0', // 例: 背景色を少し変える
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
      height: 40, // 高さを固定
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
      height: 40, // 高さを固定
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
  // partialText: { // 部分結果表示用スタイル (任意)
  //   fontSize: 18,
  //   color: colors.textSecondary,
  //   fontStyle: 'italic',
  //   paddingHorizontal: 5,
  //   marginBottom: 5,
  // },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8, // SafeArea 考慮
    borderTopWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.bottomBarBackground,
    minHeight: 55,
  },
  bottomLangButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.langButtonBackgroundOriginal,
    minWidth: 80,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  bottomLangText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentBlue,
  },
  swapButton: {
    padding: 8,
  },
  iconButtonMicCam: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    borderRadius: 22, // 円形
    marginLeft: 5,
   },
   // 録音中のマイクボタンのスタイル
   recordingButton: {
       backgroundColor: colors.errorColor + '20', // 赤色の薄い背景 (アルファ値追加)
   },
});

export default TranslateScreen;