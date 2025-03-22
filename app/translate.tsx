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
import { useTranslation } from '../hooks/useTranslation';

const TranslateScreen = () => {
  const [inputText, setInputText] = useState('');
  const { translation, loading, error, translate } = useTranslation();

  const handleTranslate = () => {
    translate(inputText);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="翻訳する英語を入力"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity
          style={styles.button}
          onPress={handleTranslate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>翻訳</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color="#0000ff" />}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>エラー: {error.message}</Text>
        </View>
      )}

      {translation && (
        <View style={styles.resultContainer}>
          <Text style={styles.heading}>意味:</Text>
          <Text style={styles.resultText}>{translation.meaning}</Text>

          <Text style={styles.heading}>発音:</Text>
          <Text style={styles.resultText}>{translation.pronunciation}</Text>

          <Text style={styles.heading}>例文:</Text>
          {translation.examples.map((example, index) => (
            <Text key={index} style={styles.resultText}>
              - {example}
            </Text>
          ))}

          <Text style={styles.heading}>類義語:</Text>
          <Text style={styles.resultText}>{translation.synonyms.join(', ')}</Text>

          <Text style={styles.heading}>補足説明:</Text>
          <Text style={styles.resultText}>{translation.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
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
  resultContainer: {
    marginTop: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultText: {
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 24,
  },
});

export default TranslateScreen;