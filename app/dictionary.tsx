import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons'; // アイコンをインポート
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAudio } from '../hooks/useAudio';
import { COMMON_STYLES, COLORS } from '../constants/styles';
import { handleApiError } from '../utils/errorHandler';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useSpeech } from '../hooks/useSpeech';

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
  suggestion: string;
}

// useVocabularyフックはモックで代用. 実際のアプリでは適切に実装してください。
const useVocabulary = () => {
  const [vocabulary, setVocabulary] = useState<VocabularyResult | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
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
    setIsSaved(false);

    try {
      const { data, error } = await supabase.functions.invoke('get-dictionary', {
        body: { vocabulary: text }
      });

      console.log('data', data);

      if (error) throw error;

      if (data) {
        // suggestionが返ってきた場合
        if ('suggestion' in data) {
          setSuggestion(data.suggestion);
          return;
        }

        // 通常の辞書データが返ってきた場合
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
        // 保存状態を確認
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

  return { vocabulary, suggestion, loading, error, translate, setVocabulary, setSuggestion, isSaved, setIsSaved };
};

const TranslateScreen = () => {
  const [inputText, setInputText] = useState('');
  const [displayText, setDisplayText] = useState('');
  const { vocabulary, suggestion, loading, error, translate, setVocabulary, setSuggestion, isSaved, setIsSaved } = useVocabulary();
  const { session } = useAuth();
  const { playSound } = useAudio();
  const { speakText } = useSpeech();

  const handleTranslate = () => {
    setDisplayText(inputText);
    translate(inputText);
  };

  const handleSuggestionClick = () => {
    if (suggestion) {
      setInputText(suggestion);
      setDisplayText(suggestion);
      translate(suggestion);
    }
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
    setIsSaved(false);
  };

  if (loading) {
    return (
      <View style={[COMMON_STYLES.container, styles.translateContainer]}>
        <View style={styles.searchBarContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="英語または日本語を入力"
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
            />
            {inputText.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton} 
                onPress={clearInput}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.TEXT.MEDIUM_GRAY} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.magicButton, inputText.length === 0 && styles.magicButtonDisabled]} 
            onPress={handleTranslate}
            disabled={inputText.length === 0}
          >
            <Ionicons 
              name="search" 
              size={20} 
              color={inputText.length === 0 ? COLORS.TEXT.DISABLED : COLORS.SECONDARY} 
            />
          </TouchableOpacity>
        </View>
        <View style={COMMON_STYLES.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={COMMON_STYLES.loadingText}>翻訳中...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={COMMON_STYLES.errorContainer}>
        <Text style={COMMON_STYLES.errorText}>{error.message}</Text>
        <TouchableOpacity
          style={COMMON_STYLES.retryButton}
          onPress={clearInput}
        >
          <Text style={COMMON_STYLES.retryButtonText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[COMMON_STYLES.container, styles.translateContainer]}>
      <View style={styles.searchBarContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="英語または日本語を入力"
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
          />
          {inputText.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={clearInput}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.TEXT.MEDIUM_GRAY} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={[styles.magicButton, inputText.length === 0 && styles.magicButtonDisabled]} 
          onPress={handleTranslate}
          disabled={inputText.length === 0}
        >
          <Ionicons 
            name="search" 
            size={20} 
            color={inputText.length === 0 ? COLORS.TEXT.DISABLED : COLORS.SECONDARY} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {suggestion && (
          <View style={styles.suggestionContainer}>
            <View style={styles.suggestionContent}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="search-circle" size={20} color={COLORS.SECONDARY} />
                <Text style={styles.suggestionText}>もしかして？</Text>
              </View>
              <TouchableOpacity 
                style={styles.suggestionButton}
                onPress={handleSuggestionClick}
              >
                <Text style={styles.suggestionWord}>{suggestion}</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.SECONDARY} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {vocabulary && (
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
    marginRight: 8,
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
  },
  magicButtonDisabled: {
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
    padding: 16,
    width: '100%',
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
