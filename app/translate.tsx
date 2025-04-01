import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons'; // アイコンをインポート
import { createClient } from '@supabase/supabase-js';

interface TranslationResult {
  meaning: string;
  pronunciation: string;
  examples: string[];
  synonyms: string[];
  notes: string;
}

// Supabaseクライアントの初期化
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// useTranslationフックはモックで代用. 実際のアプリでは適切に実装してください。
const useTranslation = () => {
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | { message: string } | null>(null);

  const translate = async (text: string, targetLanguage: 'en' | 'ja') => {
    setLoading(true);
    setError(null);
    setTranslation(null);

    try {
      const { data, error } = await supabase.functions.invoke('get-dictionary', {
        body: { vocabulary: text }
      });

      if (error) throw error;

      if (data) {
        // データの形式を変換
        const formattedData: TranslationResult = {
          meaning: data.meanings ? data.meanings.join(', ') : '',
          pronunciation: data.pronunciation || '',
          examples: data.examples ? data.examples.map((ex: { en: string; ja: string }) => ex.en) : [],
          synonyms: data.synonyms || [],
          notes: data.notes || ''
        };
        setTranslation(formattedData);
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

  return { translation, loading, error, translate };
};

const TranslateScreen = () => {
  const [inputText, setInputText] = useState('');
  const [inputLanguage, setInputLanguage] = useState<'ja' | 'en'>('ja'); // 入力言語の状態を追加
  const { translation, loading, error, translate } = useTranslation();

  const handleTranslate = () => {
    translate(inputText, inputLanguage);
  };

  const clearInput = () => {
    setInputText('');
    //setTranslation(null); //Clear previous result if needed.
  };

  // 入力言語を切り替える関数
  const toggleInputLanguage = () => {
    setInputLanguage((prevLanguage) => (prevLanguage === 'ja' ? 'en' : 'ja'));
  };

  // プレースホルダーを動的に変更
  const placeholder =
    inputLanguage === 'ja' ? '日本語で入力' : 'Enter a word to translate';

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <TouchableOpacity onPress={toggleInputLanguage} style={styles.languageButton}>
          <Text style={styles.languageButtonText}>{inputLanguage === 'ja' ? '日本語' : 'English'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleTranslate} // Enterキーで翻訳
        />
        <TouchableOpacity style={styles.clearButton} onPress={clearInput}>
          <Ionicons name="close-circle-outline" size={24} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.magicButton} onPress={handleTranslate}>
          <Ionicons name="search-circle-outline" size={24} color="#777" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {loading && <ActivityIndicator size="large" color="#a5d6a7" />}

        {/* エラーメッセージの表示を削除 */}
        {/* {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>エラー: {error.message}</Text>
          </View>
        )} */}

        {translation && (
          <View style={styles.resultCard}>
            <View style={styles.wordHeader}>
              <Text style={styles.wordText}>{inputText}</Text>
              <View style={styles.iconContainer}>
                <TouchableOpacity>
                  <Ionicons name="volume-high-outline" size={24} color="#555" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.pronunciation}>{translation.pronunciation}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>定義</Text>
              <Text style={styles.sectionText}>{translation.meaning}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>類義語</Text>
              <View style={styles.synonymContainer}>
                {translation.synonyms.map((synonym, index) => (
                  <Text key={index} style={styles.synonym}>
                    {synonym}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>例文</Text>
              {translation.examples.map((example, index) => (
                <Text key={index} style={styles.sectionText}>
                  {example}
                </Text>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>補足</Text>
              <Text style={styles.sectionText}>{translation.notes}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>メモ</Text>
              <TextInput
                style={styles.memoInput}
                placeholder="タップして入力"
                multiline
              />
            </View>

            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>保存</Text>
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
    backgroundColor: '#f0f0f0', // Light gray background
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20, // Rounded input
    paddingHorizontal: 15,
    marginRight: 5,
    backgroundColor: 'white',
  },
  clearButton: {
    padding: 10,
  },
  clearButtonText: {
    fontSize: 20,
    color: '#777',
  },
  magicButton: {
    padding: 10,
  },
  magicButtonText: {
    fontSize: 20,
    color: '#777',
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  iconContainer: {
    flexDirection: 'row',
  },
  icon: {
    fontSize: 22,
    marginLeft: 15,
    color: '#555',
  },
  pronunciation: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a90e2', // Blue accent color
    marginBottom: 5,
  },
  sectionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  synonymContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow synonyms to wrap to the next line
  },
  synonym: {
    backgroundColor: '#e0f2f1', // Light teal background for synonyms
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 5,
    marginBottom: 5,
    color: '#004d40',
    fontSize: 14,
  },
  memoInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginTop: 5,
    minHeight: 80,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  saveButton: {
    backgroundColor: '#4a90e2', // Blue color for the button
    padding: 15,
    borderRadius: 25, // Fully rounded button
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#ffcccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  errorText: {
    color: '#cc0000',
  },
  languageButton: {
    padding: 10,
    marginRight: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
  },
  languageButtonText: {
    fontSize: 16,
    color: '#333',
  },
});

export default TranslateScreen;
