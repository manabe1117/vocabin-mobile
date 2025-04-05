import React, { useState } from 'react';
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
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/context/AuthContext';

interface VocabularyResult {
  id: number;
  vocabulary: string;
  meaning: string;
  pronunciation: string;
  examples: { en: string; ja: string }[];
  synonyms: string[];
  notes: string;
}

interface SuggestionResponse {
  suggestion: string;
}

// Supabaseクライアントの初期化
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
      const { data, error } = await supabase.functions.invoke(`get-study-status?vocabularyId=${vocabularyId}&type=3`, {
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
          examples: data.examples ? data.examples.map((ex: { en: string; ja: string }) => ex) : [],
          synonyms: data.synonyms || [],
          notes: data.notes || ''
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

      // 保存状態を反転させる
      setIsSaved(!isSaved);
    } catch (error) {
      console.error('保存エラー:', error);
      Alert.alert('エラー', '単語の保存に失敗しました');
    }
  };

  const clearInput = () => {
    setInputText('');
    setDisplayText('');
    setVocabulary(null);
    setSuggestion(null);
    setIsSaved(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="単語を入力"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleTranslate}
            placeholderTextColor="#999"
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
              <Ionicons name="close-circle" size={20} color="#999" />
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
            color={inputText.length === 0 ? "#ccc" : "#4a90e2"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4a90e2" />
          </View>
        )}

        {suggestion && (
          <View style={styles.suggestionContainer}>
            <View style={styles.suggestionContent}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="search-circle" size={20} color="#4a90e2" />
                <Text style={styles.suggestionText}>もしかして？</Text>
              </View>
              <TouchableOpacity 
                style={styles.suggestionButton}
                onPress={handleSuggestionClick}
              >
                <Text style={styles.suggestionWord}>{suggestion}</Text>
                <Ionicons name="arrow-forward" size={20} color="#4a90e2" />
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
              </View>
              <TouchableOpacity style={styles.soundButton}>
                <Ionicons name="volume-high" size={24} color="#4a90e2" />
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
                color={isSaved ? "#4CAF50" : "white"} 
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
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#212529',
  },
  clearButton: {
    padding: 4,
  },
  magicButton: {
    padding: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 12,
  },
  magicButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
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
    color: '#212529',
    marginBottom: 4,
  },
  pronunciation: {
    fontSize: 16,
    color: '#6c757d',
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
    color: '#4a90e2',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
  },
  synonymContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  synonym: {
    backgroundColor: '#e3f2fd',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  synonymText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '500',
  },
  exampleContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
    marginBottom: 4,
  },
  exampleTranslation: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  suggestionContainer: {
    backgroundColor: '#fff3e0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#666',
    fontWeight: '500',
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  suggestionWord: {
    fontSize: 16,
    color: '#4a90e2',
    fontWeight: 'bold',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a90e2',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  savedButton: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  savedButtonText: {
    color: '#4CAF50',
  },
});

export default TranslateScreen;
