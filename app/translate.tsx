import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const TranslateScreen = () => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');

  const handleTranslate = async () => {
    // TODO: 翻訳APIの実装
    // ここにGoogle Translate APIなどの実装を追加
    console.log('翻訳処理を実装予定');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          multiline
          placeholder="翻訳したいテキストを入力"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.translateButton} onPress={handleTranslate}>
          <MaterialIcons name="translate" size={24} color="#fff" />
          <Text style={styles.buttonText}>翻訳</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.outputContainer}>
        <Text style={styles.outputLabel}>翻訳結果</Text>
        <ScrollView style={styles.outputText}>
          <Text>{translatedText || '翻訳結果がここに表示されます'}</Text>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    marginBottom: 12,
    fontSize: 16,
  },
  translateButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outputContainer: {
    flex: 1,
  },
  outputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  outputText: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    flex: 1,
  },
});

export default TranslateScreen; 