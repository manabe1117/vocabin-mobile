import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons'; // アイコンをインポート
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAudio } from '../hooks/useAudio';
import { COMMON_STYLES, COLORS } from '../constants/styles';
import { handleApiError } from '../utils/errorHandler';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useSpeech } from '../hooks/useSpeech';
import * as FileSystem from 'expo-file-system';

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

interface SuggestionResponse {
  suggestions: string[];
}

// useVocabularyフックはモックで代用. 実際のアプリでは適切に実装してください。
const useVocabulary = () => {
  const [vocabulary, setVocabulary] = useState<VocabularyResult | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [translations, setTranslations] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | { message: string } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const { session } = useAuth();

  const checkSavedStatus = async (vocabularyId: number) => {
    if (!session) return;

    try {
      const { data, error } = await supabase.functions.invoke(`get-study-status?vocabularyId=${vocabularyId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      console.log('study-status', data);

      if (error) throw error;
      setIsSaved(data.isSaved);
    } catch (error) {
      console.error('保存状態の確認エラー:', error);
    }
  };

  const translate = async (text: string) => {
    setLoading(true);
    setError(null);
    setVocabulary(null);
    setSuggestion(null);
    setSuggestions(null);
    setTranslations(null);
    setIsSaved(false);

    try {
      const { data, error } = await supabase.functions.invoke('get-dictionary', {
        body: { vocabulary: text }
      });

      console.log('data', data);

      if (error) throw error;

      if (data) {
        if ('translations' in data && Array.isArray(data.translations)) {
          setTranslations(data.translations);
          return;
        }
        
        if ('suggestions' in data && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
          return;
        }

        if ('suggestion' in data) {
          setSuggestion(data.suggestion);
          return;
        }

        const formattedData: VocabularyResult = {
          id: data.id,
          vocabulary: data.vocabulary || '',
          meaning: data.meanings ? data.meanings.join(', ') : '',
          pronunciation: data.pronunciation || '',
          part_of_speech: data.partOfSpeech || '',
          examples: data.examples ? data.examples.map((ex: { en: string; ja: string }) => ex) : [],
          synonyms: data.synonyms || [],
          notes: data.notes || '',
          audio_url: data.audio_url || undefined
        };
        setVocabulary(formattedData);
        await checkSavedStatus(data.id);
      } else {
        setError({ message: `「${text}」の翻訳データが見つかりません。` });
      }
    } catch (err) {
      console.error('Translation error:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { 
    vocabulary, 
    suggestion, 
    suggestions,
    translations,
    loading, 
    error, 
    translate, 
    setVocabulary, 
    setSuggestion, 
    setSuggestions,
    setTranslations,
    isSaved, 
    setIsSaved 
  };
};

const TranslateScreen = () => {
  const [inputText, setInputText] = useState('');
  const [displayText, setDisplayText] = useState('');
  const { 
    vocabulary, 
    suggestion, 
    suggestions,
    translations,
    loading, 
    error, 
    translate, 
    setVocabulary, 
    setSuggestion, 
    setSuggestions,
    setTranslations,
    isSaved, 
    setIsSaved 
  } = useVocabulary();
  const { session } = useAuth();
  const { playSound } = useAudio();
  const { speakText } = useSpeech();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [voiceLanguage, setVoiceLanguage] = useState<'en-US' | 'ja-JP'>('en-US'); // 音声入力言語

  const handleTranslate = () => {
    setDisplayText(inputText);
    translate(inputText);
  };

  const handleSuggestionClick = (text: string) => {
    setInputText(text);
    setDisplayText(text);
    setSuggestion(null);
    setSuggestions(null);
    translate(text);
  };

  const handleTranslationClick = (translation: string) => {
    setInputText(translation);
    setDisplayText(translation);
    setTranslations(null);
    translate(translation);
  };

  const handleSave = async () => {
    if (!session) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    if (!vocabulary) {
      Alert.alert('エラー', '保存する単語がありません');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('update-study-status', {
        method: 'POST',
        body: {
          vocabularyId: vocabulary.id,
          type: 3
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      setIsSaved(!isSaved);
    } catch (error) {
      handleApiError(error, '単語の保存');
    }
  };

  const handlePlaySound = async (text: string) => {
    if (text) {
      speakText(text, '英語');
    }
  };

  const clearInput = () => {
    setInputText('');
    setDisplayText('');
    setVocabulary(null);
    setSuggestion(null);
    setSuggestions(null);
    setTranslations(null);
    setIsSaved(false);
  };

  async function startRecording() {
    if (isRecording || isTranscribing) return;
    try {
      setInputText('');
      setDisplayText('');
      setVocabulary(null);
      setSuggestion(null);
      
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
      setVocabulary(null);
      setSuggestion(null);

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
      const languageCode = voiceLanguage; // 選択された音声言語コードを使用

      console.log(`Sending audio with contentType: ${contentType} and language: ${languageCode}`);

      const { data, error: invokeError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audioBase64: base64Audio,
          languageCode: languageCode,
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
      } else if (data && data.error) {
        console.error('Supabase function returned an error:', data.error);
        throw new Error(data.error);
      } else {
        console.warn('Transcription result is empty or invalid:', data);
        if (fileInfo.size < 10000 && data?.transcript === '') {
          Alert.alert('エラー', '録音時間が短いか、無音の可能性があります。');
        } else {
          Alert.alert('エラー', '音声が認識できませんでした。');
        }
      }

    } catch (err: any) {
      console.error('Supabase function invocation or processing failed:', err);
      Alert.alert('エラー', `文字起こしエラー: ${err.message || '不明なエラー'}`);
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

  const handleMicButtonPress = () => { 
    if (isRecording) stopRecording(); 
    else startRecording(); 
  };

  // 音声入力言語を切り替える関数
  const toggleVoiceLanguage = () => {
    setVoiceLanguage(prev => prev === 'en-US' ? 'ja-JP' : 'en-US');
  };

  return (
    <View style={[COMMON_STYLES.container, styles.translateContainer]}>
      <View style={styles.searchBarContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={isRecording ? "録音中..." : isTranscribing ? "文字起こし中..." : "英語または日本語を入力"}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleTranslate}
            placeholderTextColor={COLORS.TEXT.MEDIUM_GRAY}
            textContentType="none"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            multiline={false}
            returnKeyType="search"
            enablesReturnKeyAutomatically={true}
            blurOnSubmit={true}
            keyboardType="default"
            keyboardAppearance="light"
            inputMode="text"
            editable={!isRecording && !isTranscribing && !loading}
          />
          {inputText.length > 0 && !isRecording && !isTranscribing && !loading && (
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={clearInput}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.TEXT.MEDIUM_GRAY} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={[styles.magicButton, (inputText.length === 0 && !isRecording && !loading) && styles.magicButtonDisabled]} 
          onPress={handleTranslate}
          disabled={(inputText.length === 0 && !isRecording) || loading}
        >
          <Ionicons 
            name="search" 
            size={20} 
            color={inputText.length === 0 && !isRecording && !loading ? COLORS.TEXT.DISABLED : COLORS.SECONDARY} 
          />
        </TouchableOpacity>
        <View style={styles.voiceControlGroup}>
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonRecording]}
            onPress={handleMicButtonPress}
            disabled={isTranscribing || loading}
          >
            <Ionicons
              name={isRecording ? "stop-circle" : "mic-outline"}
              size={20}
              color={isRecording ? COLORS.WHITE : isTranscribing || loading ? COLORS.TEXT.DISABLED : COLORS.SECONDARY}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.voiceLangButton}
            onPress={toggleVoiceLanguage}
            disabled={isRecording || isTranscribing || loading}
          >
            <Text style={styles.voiceLangButtonText}>
              {voiceLanguage === 'en-US' ? 'EN' : 'JP'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <Text style={styles.loadingText}>検索中...</Text>
          </View>
        )}
        {!loading && isTranscribing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <Text style={styles.loadingText}>音声をテキストに変換中...</Text>
          </View>
        )}
        {!loading && translations && translations.length > 0 && (
          <View style={styles.suggestionContainer}>
            <View style={styles.suggestionContent}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="language" size={20} color={COLORS.SECONDARY} />
                <Text style={styles.suggestionText}>翻訳候補</Text>
              </View>
              {translations.map((translation, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleTranslationClick(translation)}
                >
                  <Text style={styles.suggestionWord}>{translation}</Text>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.SECONDARY} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {!loading && suggestions && suggestions.length > 0 && (
          <View style={styles.suggestionContainer}>
            <View style={styles.suggestionContent}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="search-circle" size={20} color={COLORS.SECONDARY} />
                <Text style={styles.suggestionText}>もしかして？</Text>
              </View>
              {suggestions.map((suggestionText, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionClick(suggestionText)}
                >
                  <Text style={styles.suggestionWord}>{suggestionText}</Text>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.SECONDARY} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {!loading && suggestion && (
          <View style={styles.suggestionContainer}>
            <View style={styles.suggestionContent}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="search-circle" size={20} color={COLORS.SECONDARY} />
                <Text style={styles.suggestionText}>もしかして？</Text>
              </View>
              <TouchableOpacity 
                style={styles.suggestionButton}
                onPress={() => handleSuggestionClick(suggestion)}
              >
                <Text style={styles.suggestionWord}>{suggestion}</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.SECONDARY} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        {!loading && vocabulary && (
          <View style={styles.resultCard}>
            <View style={styles.wordHeader}>
              <View style={styles.wordContainer}>
                <Text style={styles.wordText}>{vocabulary.vocabulary}</Text>
                <Text style={styles.pronunciation}>{vocabulary.pronunciation}</Text>
                <Text style={styles.partOfSpeech}>{vocabulary.part_of_speech}</Text>
              </View>
              <TouchableOpacity 
                style={styles.soundButton}
                onPress={() => handlePlaySound(vocabulary.vocabulary)}
              >
                <Ionicons name="volume-high" size={24} color={COLORS.PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>意味</Text>
              <Text style={styles.sectionText}>{vocabulary.meaning}</Text>
            </View>

            {vocabulary.synonyms.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>類義語</Text>
                <View style={styles.synonymContainer}>
                  {vocabulary.synonyms.map((synonym, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.synonym}
                      onPress={() => {
                        setInputText(synonym);
                        translate(synonym);
                      }}
                    >
                      <Text style={styles.synonymText}>{synonym}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {vocabulary.examples.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>例文</Text>
                {vocabulary.examples.map((example, index) => (
                  <View key={index} style={styles.exampleContainer}>
                    <Text style={styles.exampleText}>{example.en}</Text>
                    <Text style={styles.exampleTranslation}>{example.ja}</Text>
                  </View>
                ))}
              </View>
            )}

            {vocabulary.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>補足</Text>
                <Text style={styles.sectionText}>{vocabulary.notes}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.saveButton, isSaved && styles.savedButton]} 
              onPress={handleSave}
            >
              <Ionicons 
                name={isSaved ? "checkmark-circle" : "bookmark-outline"} 
                size={20} 
                color={isSaved ? COLORS.SUCCESS.DARK : COLORS.WHITE} 
                style={styles.saveButtonIcon} 
              />
              <Text style={[styles.saveButtonText, isSaved && styles.savedButtonText]}>
                {isSaved ? '保存済み' : '保存'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  translateContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND.MAIN,
    padding: 0,
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND.MAIN,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.GRAY_LIGHT,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND.MAIN,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.TEXT.DARKER,
  },
  clearButton: {
    padding: 4,
  },
  magicButton: {
    padding: 10,
    backgroundColor: COLORS.BACKGROUND.GRAY_LIGHT,
    borderRadius: 12,
    marginRight: 4,
  },
  magicButtonDisabled: {
    opacity: 0.7,
  },
  voiceControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER.GRAY_LIGHT,
    borderRadius: 16,
    padding: 4,
    marginLeft: 4,
    backgroundColor: COLORS.BACKGROUND.MAIN,
    minWidth: 90,
    justifyContent: 'space-between',
  },
  micButton: {
    padding: 8,
    backgroundColor: COLORS.BACKGROUND.GRAY_LIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: COLORS.PRIMARY,
  },
  voiceLangButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginLeft: 0,
    backgroundColor: COLORS.BACKGROUND.GRAY_LIGHT,
    alignItems: 'center',
  },
  voiceLangButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.SECONDARY,
  },
  scrollView: {
    flex: 1,
    padding: 16,
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.TEXT.MEDIUM_GRAY,
    fontSize: 16,
  },
  resultCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  wordContainer: {
    flex: 1,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT.DARKER,
    marginBottom: 4,
  },
  pronunciation: {
    fontSize: 16,
    color: COLORS.TEXT.LIGHT_GRAY,
  },
  soundButton: {
    padding: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.SECONDARY,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: COLORS.TEXT.DARK_GRAY,
    lineHeight: 24,
  },
  synonymContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  synonym: {
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  synonymText: {
    color: COLORS.TEXT.BLUE_LIGHT,
    fontSize: 14,
    fontWeight: '500',
  },
  exampleContainer: {
    backgroundColor: COLORS.BACKGROUND.MAIN,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 16,
    color: COLORS.TEXT.DARK_GRAY,
    lineHeight: 24,
    marginBottom: 4,
  },
  exampleTranslation: {
    fontSize: 14,
    color: COLORS.TEXT.LIGHT_GRAY,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  suggestionContainer: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionContent: {
    flexDirection: 'column',
    gap: 8,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.SECONDARY,
    fontWeight: '500',
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.BACKGROUND.MAIN,
    padding: 12,
    borderRadius: 8,
  },
  suggestionWord: {
    fontSize: 16,
    color: COLORS.SECONDARY,
    fontWeight: 'bold',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SECONDARY,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    height: 44,
  },
  savedButton: {
    backgroundColor: COLORS.BACKGROUND.MAIN,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY,
    height: 44,
    padding: 11,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  savedButtonText: {
    color: COLORS.SECONDARY,
    lineHeight: 20,
  },
  partOfSpeech: {
    fontSize: 16,
    color: COLORS.TEXT.LIGHT_GRAY,
    marginBottom: 4,
  },
});

export default TranslateScreen;
