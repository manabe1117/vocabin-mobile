// app/translate.tsx
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
  Linking,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { supabase } from '../lib/supabase';
import { useSpeech } from '../hooks/useSpeech';
import CameraModal from '../components/CameraModal';
import DictionaryModal from '../components/DictionaryModal';
import DictionaryBanner from '../components/DictionaryBanner';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/styles';

const colors = {
  background: COLORS.BACKGROUND.MAIN,
  inputBackground: COLORS.WHITE,
  outputBackground: COLORS.WHITE,
  textPrimary: COLORS.TEXT_PRIMARY,
  textSecondary: COLORS.TEXT_SECONDARY,
  accentBlue: COLORS.PRIMARY,
  iconColor: COLORS.ICON.DEFAULT,
  iconColorDisabled: COLORS.ICON.DISABLED,
  borderColor: COLORS.BORDER.LIGHT,
  rippleColor: COLORS.EFFECTS.RIPPLE,
  errorColor: COLORS.ERROR.DARKER,
  placeholderColor: COLORS.TEXT.MEDIUM_GRAY,
  bottomBarBackground: COLORS.WHITE,
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
    padding: 16,
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

// VocabularyResult型をtranslate.tsx内で定義
interface VocabularyResult {
  id: number;
  vocabulary: string;
  meaning: string;
  pronunciation: string;
  part_of_speech: string;
  examples: { en: string; ja: string }[];
  synonyms: string[];
  notes: string;
  audio_url?: string;
}

const TranslateScreen = () => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('英語');
  const [targetLang, setTargetLang] = useState('日本語');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { speakText } = useSpeech();
  const [isCameraModalVisible, setIsCameraModalVisible] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [dictModalVisible, setDictModalVisible] = useState(false);
  const [selectedVocabularies, setSelectedVocabularies] = useState<VocabularyResult[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerVocabularies, setBannerVocabularies] = useState<VocabularyResult[]>([]);
  const [outputSelection, setOutputSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [outputBannerVisible, setOutputBannerVisible] = useState(false);
  const [outputBannerVocabularies, setOutputBannerVocabularies] = useState<VocabularyResult[]>([]);
  const { session } = useAuth();
  const [bannerSaved, setBannerSaved] = useState<boolean>(false);
  const [outputBannerSaved, setOutputBannerSaved] = useState<boolean>(false);

  const getLanguageCode = (lang: string, type: 'translate' | 'voice' = 'translate'): string => {
    if (type === 'voice') {
      switch (lang) {
        case '日本語': return 'ja-JP';
        case '英語': return 'en-US';
        default: return 'en-US';
      }
    } else {
      switch (lang) {
        case '日本語': return 'ja';
        case '英語': return 'en';
        default: return 'en';
      }
    }
  };

  async function startRecording() {
    if (isRecording || isTranscribing) return;
    try {
      let currentStatus = permissionResponse?.status;
      if (currentStatus !== 'granted') {
        console.log('Requesting microphone permission..');
        const { status } = await requestPermission();
        currentStatus = status;
      }
      if (currentStatus !== 'granted') {
        Alert.alert(
          '権限が必要です',
          '音声入力のためにマイクへのアクセスを許可してください。',
          [
            {
              text: '許可する',
              onPress: async () => {
                const { status: newStatus } = await requestPermission();
                if (newStatus !== 'granted') {
                  Alert.alert( '権限が必要です', '音声入力を使用するにはマイクへのアクセスを許可する必要があります。設定画面から許可してください。',
                    [ { text: '設定を開く', onPress: () => Linking.openSettings() }, { text: 'キャンセル', style: 'cancel' } ], { cancelable: false }
                  );
                } else { startRecording(); }
              },
            },
            { text: 'キャンセル', style: 'cancel' },
          ],
          { cancelable: false }
        );
        return;
      }

      console.log('Starting recording with expo-av...');
      setIsRecording(true);
      setError(null);
      setTranslatedText('');
      Keyboard.dismiss();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions: Audio.RecordingOptions = {
          android: {
            extension: '.amr',
            outputFormat: Audio.AndroidOutputFormat.AMR_NB,
            audioEncoder: Audio.AndroidAudioEncoder.AMR_NB,
            sampleRate: 8000,
            numberOfChannels: 1,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {},
      };
      console.log(`Attempting to record with options for ${Platform.OS}:`, Platform.OS === 'ios' ? recordingOptions.ios : recordingOptions.android);

      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);
      console.log('Recording started');

    } catch (err: any) {
      console.error('Failed to start recording', err);
      setError(`録音の開始に失敗しました: ${err.message || '不明なエラー'}`);
      setIsRecording(false);
      if (recording) { try { await recording.stopAndUnloadAsync(); } catch {} }
      setRecording(null);
    }
  }

  async function stopRecording() {
    if (!recording) {
      console.warn('Recording instance is null, cannot stop.');
      setIsRecording(false);
      return;
    }
    console.log('Stopping recording...');
    setIsRecording(false);
    setIsTranscribing(true);
    setError(null);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error('録音ファイルのURIが取得できませんでした。');
      console.log('Recording stopped and stored at', uri);

      const contentType = Platform.OS === 'ios' ? 'audio/wav' : 'audio/amr';
      await sendAudioToSupabase(uri, contentType);

    } catch (err: any) {
      console.error('Failed to stop recording or transcribe', err);
      setError(`録音の停止または文字起こしに失敗しました: ${err.message || '不明なエラー'}`);
      setIsTranscribing(false);
      setRecording(null);
    }
  }

  async function sendAudioToSupabase(fileUri: string, contentType: string) {
    let fileInfo;
    try {
      console.log('Checking file existence at:', fileUri);
      fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) throw new Error("録音ファイルが見つかりません。");
      console.log('File Info:', { uri: fileInfo.uri, size: fileInfo.size });

      const base64Audio = await FileSystem.readAsStringAsync(fileInfo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('Invoking Supabase function speech-to-text...');
      const targetLanguageCode = getLanguageCode(sourceLang, 'voice');

      console.log(`Sending audio with contentType: ${contentType}`);

      const { data, error: invokeError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audioBase64: base64Audio,
          languageCode: targetLanguageCode,
          contentType: contentType,
        },
      });

      if (invokeError) {
          console.error('Supabase function invocation error:', invokeError);
          throw new Error(invokeError.message || 'Function invocation failed');
      }

      if (data && typeof data.transcript === 'string') {
        console.log('Transcription result:', data.transcript);
        setInputText(data.transcript);
        setError(null);
      } else if (data && data.error) {
        console.error('Supabase function returned an error:', data.error);
        throw new Error(data.error);
      } else {
        console.warn('Transcription result is empty or invalid:', data);
        setInputText('');
        if (fileInfo.size < 10000 && data?.transcript === '') {
          setError('録音時間が短いか、無音の可能性があります。');
        } else {
          setError('音声が認識できませんでした。');
        }
      }

    } catch (err: any) {
      console.error('Supabase function invocation or processing failed:', err);
      setError(`文字起こしエラー: ${err.message || '不明なエラー'}`);
      setInputText('');
    } finally {
      setIsTranscribing(false);
      if (fileInfo && fileInfo.exists) {
        try {
          console.log('Deleting temporary audio file:', fileInfo.uri);
          await FileSystem.deleteAsync(fileInfo.uri);
          console.log('Temporary audio file deleted.');
        } catch (e) {
          console.warn("Failed to delete audio file", e);
        }
      } else if (fileUri && !fileInfo) {
        try {
          console.log('Attempting to delete audio file with original URI:', fileUri);
          await FileSystem.deleteAsync(fileUri);
          console.log('Temporary audio file deleted (fallback attempt).');
        } catch (e) {
          console.warn("Failed to delete audio file (fallback attempt)", e);
        }
      }
    }
  }

  const handleMicButtonPress = () => { if (isRecording) stopRecording(); else startRecording(); };

  const handleTranslate = async (textToTranslate: string) => {
    const trimmedText = textToTranslate.trim();
    if (!trimmedText || isRecording || isTranscribing) {
      if (!trimmedText) {
          setTranslatedText('');
          setIsLoading(false);
      }
      return;
    }
    console.log('Starting translation...');
    setIsLoading(true);
    setError(null);
    setTranslatedText('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('translate', {
        body: {
          text: trimmedText,
          sourceLang: sourceLang,
          targetLang: targetLang
        }
      });
      if (invokeError) throw invokeError;
      if (data && data.translatedText) {
        setTranslatedText(data.translatedText);
        setError(null);
      } else if (data && data.error) {
          throw new Error(data.error);
      } else {
        throw new Error('翻訳結果が取得できませんでした。');
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      setError(`翻訳エラー: ${error.message || '不明なエラー'}`);
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  };

  const swapLanguages = () => {
    if (isLoading || isRecording || isTranscribing) return;
    const currentSource = sourceLang;
    const currentTarget = targetLang;
    const currentInput = inputText;
    const currentOutput = translatedText;
    setSourceLang(currentTarget);
    setTargetLang(currentSource);
    if (currentOutput.trim() && !error && !isLoading) {
      setInputText(currentOutput);
    } else {
      setInputText(currentInput);
    }
    setTranslatedText('');
    setError(null);
  };

  const clearInput = () => {
    if (isRecording) { stopRecording(); return; }
    if (isTranscribing || isLoading) return;
    setInputText('');
    setTranslatedText('');
    setError(null);
    if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); }
    setIsLoading(false);
    inputRef.current?.focus();
  };

  const copyToClipboard = async (text: string) => {
    if (!text || isRecording || isTranscribing || isLoading) return;
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('コピー完了', '翻訳結果をクリップボードにコピーしました。');
    } catch (e) {
      console.error('Clipboard copy error:', e);
      Alert.alert('エラー', 'クリップボードへのコピーに失敗しました。');
    }
  };

  useEffect(() => {
    if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); }
    const textToTranslate = inputText.trim();
    if (isRecording || isTranscribing || !textToTranslate) {
      setTranslatedText('');
      setIsLoading(false);
      return;
    }
    debounceTimeout.current = setTimeout(() => {
      handleTranslate(textToTranslate);
    }, 800);
    return () => {
      if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); }
    };
  }, [inputText, sourceLang, targetLang]);

  // カメラボタンが押されたときの処理
  const handleCameraInput = () => {
    if (isRecording || isTranscribing || isLoading || isProcessingImage) return;
    Keyboard.dismiss(); // カメラ表示前にキーボードを閉じる
    setIsCameraModalVisible(true);
  };

  // カメラモーダルを閉じる処理
  const handleCloseCamera = () => {
    setIsCameraModalVisible(false);
  };

  // 写真が撮影され、Base64データが渡されたときの処理
  const handlePictureTaken = async (base64Image: string) => {
    setIsCameraModalVisible(false); // カメラを閉じる
    if (!base64Image) {
      Alert.alert('エラー', '画像データの取得に失敗しました。');
      return;
    }
    console.log('Picture taken, processing image...');
    setIsProcessingImage(true);
    setError(null);
    setTranslatedText('');

    try {
      // Supabase Function (例: 'image-to-text') を呼び出す
      console.log('Invoking Supabase function image-to-text...');
      const { data, error: invokeError } = await supabase.functions.invoke('image-to-text', {
        body: { imageBase64: base64Image },
        // 必要であれば、言語ヒントなどを追加で送ることも可能
        // body: { imageBase64: base64Image, languageHints: [getLanguageCode(sourceLang)] },
      });

      if (invokeError) {
        console.error('Supabase function invocation error (image-to-text):', invokeError);
        throw new Error(invokeError.message || 'Function invocation failed');
      }

      if (data && typeof data.text === 'string') {
        console.log('OCR result:', data.text);
        if (data.text.trim()) {
          setInputText(data.text); // 抽出したテキストを入力欄にセット
          setError(null);
          // テキストがセットされると、useEffect内のhandleTranslateが自動で実行される
        } else {
          setError('画像からテキストを検出できませんでした。');
          setInputText('');
        }
      } else if (data && data.error) {
        console.error('Supabase function returned an error (image-to-text):', data.error);
        throw new Error(data.error);
      } else {
        console.warn('OCR result is empty or invalid:', data);
        setError('画像からテキストを検出できませんでした。');
        setInputText('');
      }

    } catch (err: any) {
      console.error('Image processing or OCR failed:', err);
      setError(`画像処理エラー: ${err.message || '不明なエラー'}`);
      setInputText('');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSpeakInput = () => {
      if (inputText && !isRecording && !isTranscribing && !isLoading) {
          speakText(inputText, getLanguageCode(sourceLang, 'voice'));
      }
  };
  const handleSpeakOutput = () => {
      if (translatedText && !isRecording && !isTranscribing && !isLoading && !error) {
          speakText(translatedText, getLanguageCode(targetLang, 'voice'));
      }
  };

  // 選択範囲のテキスト取得
  const selectedText = inputText.substring(selection.start, selection.end);

  useEffect(() => {
    let ignore = false;
    const fetchVocabulary = async () => {
      if (selectedText && selectedText.trim().length > 0) {
        setBannerVisible(false);
        setBannerVocabularies([]);
        setBannerSaved(false);
        try {
          const { data, error } = await supabase.functions.invoke('get-dictionary', {
            body: { vocabulary: selectedText.trim() },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          });
          if (error) throw error;
          if (data && !('suggestion' in data)) {
            const formatted: VocabularyResult = {
              id: data.id,
              vocabulary: data.vocabulary || '',
              meaning: data.meanings ? data.meanings.join(', ') : '',
              pronunciation: data.pronunciation || '',
              part_of_speech: data.partOfSpeech || '',
              examples: data.examples ? data.examples.map((ex: { en: string; ja: string }) => ex) : [],
              synonyms: data.synonyms || [],
              notes: data.notes || '',
              audio_url: data.audio_url || undefined,
            };
            if (!ignore) {
              setBannerVocabularies([formatted]);
              setBannerVisible(true);
              // 保存状態取得
              if (session?.access_token && formatted.id) {
                try {
                  const { data: statusData, error: statusError } = await supabase.functions.invoke(`get-study-status?vocabularyId=${formatted.id}`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  });
                  if (statusError) throw statusError;
                  setBannerSaved(!!statusData?.isSaved);
                } catch {
                  setBannerSaved(false);
                }
              } else {
                setBannerSaved(false);
              }
            }
          } else {
            if (!ignore) {
              setBannerVocabularies([]);
              setBannerVisible(false);
              setBannerSaved(false);
            }
          }
        } catch (e) {
          setBannerVocabularies([]);
          setBannerVisible(false);
          setBannerSaved(false);
        }
      } else {
        setBannerVocabularies([]);
        setBannerVisible(false);
        setBannerSaved(false);
      }
    };
    fetchVocabulary();
    return () => { ignore = true; };
  }, [selectedText, session]);

  const handleBannerSave = async (vocabularyId: number, next: boolean) => {
    if (!session?.access_token) return;
    try {
      const { error } = await supabase.functions.invoke('update-study-status', {
        method: 'POST',
        body: { vocabularyId, type: 3 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setBannerSaved(next);
    } catch {
      // エラー時は何もしない
    }
  };

  const outputSelectedText = translatedText.substring(outputSelection.start, outputSelection.end);

  useEffect(() => {
    let ignore = false;
    const fetchVocabulary = async () => {
      if (outputSelectedText && outputSelectedText.trim().length > 0) {
        setOutputBannerVisible(false);
        setOutputBannerVocabularies([]);
        setOutputBannerSaved(false);
        try {
          const { data, error } = await supabase.functions.invoke('get-dictionary', {
            body: { vocabulary: outputSelectedText.trim() },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          });
          if (error) throw error;
          if (data && !('suggestion' in data)) {
            const formatted: VocabularyResult = {
              id: data.id,
              vocabulary: data.vocabulary || '',
              meaning: data.meanings ? data.meanings.join(', ') : '',
              pronunciation: data.pronunciation || '',
              part_of_speech: data.partOfSpeech || '',
              examples: data.examples ? data.examples.map((ex: { en: string; ja: string }) => ex) : [],
              synonyms: data.synonyms || [],
              notes: data.notes || '',
              audio_url: data.audio_url || undefined,
            };
            if (!ignore) {
              setOutputBannerVocabularies([formatted]);
              setOutputBannerVisible(true);
              // 保存状態取得
              if (session?.access_token && formatted.id) {
                try {
                  const { data: statusData, error: statusError } = await supabase.functions.invoke(`get-study-status?vocabularyId=${formatted.id}`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  });
                  if (statusError) throw statusError;
                  setOutputBannerSaved(!!statusData?.isSaved);
                } catch {
                  setOutputBannerSaved(false);
                }
              } else {
                setOutputBannerSaved(false);
              }
            }
          } else {
            if (!ignore) {
              setOutputBannerVocabularies([]);
              setOutputBannerVisible(false);
              setOutputBannerSaved(false);
            }
          }
        } catch (e) {
          setOutputBannerVocabularies([]);
          setOutputBannerVisible(false);
          setOutputBannerSaved(false);
        }
      } else {
        setOutputBannerVocabularies([]);
        setOutputBannerVisible(false);
        setOutputBannerSaved(false);
      }
    };
    fetchVocabulary();
    return () => { ignore = true; };
  }, [outputSelectedText, session]);

  const handleOutputBannerSave = async (vocabularyId: number, next: boolean) => {
    if (!session?.access_token) return;
    try {
      const { error } = await supabase.functions.invoke('update-study-status', {
        method: 'POST',
        body: { vocabularyId, type: 3 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setOutputBannerSaved(next);
    } catch {
      // エラー時は何もしない
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <>
        <ThemedView style={styles.container}>
          {/* Input Area */}
          <View style={styles.inputArea}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContentContainer}
              keyboardShouldPersistTaps="handled" >
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                multiline
                editable={!isRecording && !isTranscribing}
                placeholder={ isRecording ? "録音中..." : isTranscribing ? "文字起こし中..." : (sourceLang === '英語' ? "Enter text" : "テキストを入力")}
                placeholderTextColor={colors.placeholderColor}
                value={inputText}
                onChangeText={setInputText}
                textAlignVertical="top"
                scrollEnabled={false}
                onSelectionChange={e => setSelection(e.nativeEvent.selection)}
              />
            </ScrollView>
            <View style={styles.inputActionsContainer}>
              {inputText.length > 0 && !isRecording && !isTranscribing && !isLoading ? (
                <React.Fragment>
                  <TouchableOpacity onPress={handleSpeakInput} style={styles.iconButton} disabled={!inputText || isRecording || isTranscribing || isLoading} >
                    <Ionicons name="volume-high-outline" size={24} color={!inputText || isRecording || isTranscribing || isLoading ? colors.iconColorDisabled : colors.iconColor} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={clearInput} style={styles.iconButton} disabled={isRecording || isTranscribing || isLoading} >
                    <Ionicons name="close-circle" size={24} color={isRecording || isTranscribing || isLoading ? colors.iconColorDisabled : colors.iconColor} />
                  </TouchableOpacity>
                </React.Fragment>
              ) : <View style={{ height: 40 }} />}
            </View>
          </View>
          <View style={styles.divider} />
          {/* Output Area */}
          <View style={styles.outputArea}>
            <View style={styles.outputLabelContainer}>
              <ThemedText style={styles.targetLanguageLabel}>{targetLang}</ThemedText>
            </View>
            {isTranscribing ? ( <View style={COMMON_STYLES.loadingContainer}><ActivityIndicator size="large" color={colors.accentBlue} /><ThemedText style={styles.loadingText}>音声をテキストに変換中...</ThemedText></View>
            ) : isLoading ? ( <View style={COMMON_STYLES.loadingContainer}><ActivityIndicator size="large" color={colors.accentBlue} /><ThemedText style={styles.loadingText}>翻訳中...</ThemedText></View>
            ) : error ? ( <View style={COMMON_STYLES.errorContainer}><Ionicons name="warning-outline" size={30} color={colors.errorColor} /><ThemedText style={[COMMON_STYLES.errorText, { color: colors.errorColor }]}>{error}</ThemedText></View>
            ) : translatedText ? (
              <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled" >
                <TextInput
                  style={styles.outputText}
                  value={translatedText}
                  editable={true}
                  multiline
                  onChangeText={() => setTranslatedText(translatedText)}
                  onSelectionChange={e => setOutputSelection(e.nativeEvent.selection)}
                  showSoftInputOnFocus={false}
                />
              </ScrollView>
            ) : ( <View style={styles.placeholderContainer}><ThemedText style={styles.placeholderText}>{inputText ? "翻訳結果がここに表示されます" : "テキストを入力するか、\nマイクボタンを押して音声入力"}</ThemedText></View> )}
            <View style={styles.outputActionsBottomContainer}>
              {translatedText && !isLoading && !error && !isTranscribing && !isRecording ? (
                <React.Fragment>
                  <TouchableOpacity onPress={handleSpeakOutput} style={styles.iconButton} disabled={!translatedText || isLoading || !!error || isTranscribing || isRecording} >
                    <Ionicons name="volume-high-outline" size={24} color={!translatedText || isLoading || !!error || isTranscribing || isRecording ? colors.iconColorDisabled : colors.iconColor} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => copyToClipboard(translatedText)} style={styles.iconButton} disabled={!translatedText || isLoading || !!error || isTranscribing || isRecording} >
                    <Ionicons name="copy-outline" size={22} color={!translatedText || isLoading || !!error || isTranscribing || isRecording ? colors.iconColorDisabled : colors.iconColor} />
                  </TouchableOpacity>
                </React.Fragment>
              ) : <View style={{ height: 40 }} />}
            </View>
          </View>
          {/* Bottom Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bottomLangButton} disabled={isRecording || isTranscribing || isLoading}>
              <ThemedText style={[styles.bottomLangText, (isRecording || isTranscribing || isLoading) && styles.disabledText]}>{sourceLang}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={swapLanguages} style={styles.swapButton} disabled={isLoading || isRecording || isTranscribing}>
              <Ionicons name="swap-horizontal" size={24} color={isLoading || isRecording || isTranscribing ? colors.iconColorDisabled : colors.accentBlue} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomLangButton} disabled={isRecording || isTranscribing || isLoading}>
              <ThemedText style={[styles.bottomLangText, (isRecording || isTranscribing || isLoading) && styles.disabledText]}>{targetLang}</ThemedText>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleMicButtonPress} disabled={isTranscribing} style={[styles.iconButtonMicCam, isRecording && styles.recordingButton, isTranscribing && styles.disabledButton]} >
              <Ionicons name={isRecording ? "stop-circle-outline" : "mic-outline"} size={28} color={isRecording ? colors.errorColor : isTranscribing ? colors.iconColorDisabled : colors.iconColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCameraInput} style={[styles.iconButtonMicCam, (isRecording || isTranscribing || isLoading) && styles.disabledButton, { marginLeft: 12 }]} disabled={isRecording || isTranscribing || isLoading} >
              <Ionicons name="camera-outline" size={28} color={isRecording || isTranscribing || isLoading ? colors.iconColorDisabled : colors.iconColor} />
            </TouchableOpacity>
          </View>
        </ThemedView>
        {/* カメラモーダル */}
        <CameraModal
          isVisible={isCameraModalVisible}
          onClose={handleCloseCamera}
          onPictureTaken={handlePictureTaken}
        />
        {/* DictionaryBanner */}
        <DictionaryBanner
          visible={bannerVisible}
          vocabularies={bannerVocabularies}
          onClose={() => setBannerVisible(false)}
          isSaved={bannerSaved}
          onSave={handleBannerSave}
        />
        <DictionaryBanner
          visible={outputBannerVisible}
          vocabularies={outputBannerVocabularies}
          onClose={() => setOutputBannerVisible(false)}
          isSaved={outputBannerSaved}
          onSave={handleOutputBannerSave}
        />
      </>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inputArea: { flex: 1, backgroundColor: colors.inputBackground, paddingTop: Platform.OS === 'android' ? 10 : 20, paddingHorizontal: 16, justifyContent: 'space-between' },
    outputArea: { flex: 1, backgroundColor: colors.outputBackground, paddingHorizontal: 16, paddingTop: 5, paddingBottom: 5, justifyContent: 'space-between' },
    divider: { height: 1, backgroundColor: colors.borderColor },
    scrollView: { flex: 1 },
    scrollContentContainer: { flexGrow: 1, paddingBottom: 10 },
    textInput: { fontSize: 22, color: colors.textPrimary, lineHeight: 30, minHeight: 80, paddingTop: Platform.OS === 'ios' ? 8 : 0 },
    outputText: { fontSize: 22, color: colors.textPrimary, lineHeight: 30, paddingVertical: 8 },
    inputActionsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 5, height: 40 },
    outputLabelContainer: { minHeight: 30, justifyContent: 'center', paddingLeft: 8 },
    outputActionsBottomContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 5, height: 40 },
    targetLanguageLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    iconButton: { padding: 8, justifyContent: 'center', alignItems: 'center', width: 40, height: 40, borderRadius: 20 },
    placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
    placeholderText: { fontSize: 16, color: colors.placeholderColor, textAlign: 'center', lineHeight: 24 },
    loadingText: { marginTop: 10, fontSize: 14, color: colors.textSecondary },
    bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 25 : 10, borderTopWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.bottomBarBackground, minHeight: 55 },
    bottomLangButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.langButtonBackgroundOriginal, minWidth: 80, alignItems: 'center', marginHorizontal: 5 },
    bottomLangText: { fontSize: 14, fontWeight: '500', color: colors.accentBlue },
    disabledText: { color: colors.iconColorDisabled },
    swapButton: { padding: 8 },
    iconButtonMicCam: { padding: 8, justifyContent: 'center', alignItems: 'center', width: 44, height: 44, borderRadius: 22, marginLeft: 5 },
    recordingButton: { backgroundColor: colors.errorColor + '20' },
    disabledButton: { opacity: 0.5 },
});

export default TranslateScreen;