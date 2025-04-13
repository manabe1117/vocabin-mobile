// app/(tabs)/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router'; // Link はそのまま使用可能
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'; // MaterialCommunityIcons をインポート

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        {/* Linkのhrefはルートからの絶対パスを指定 */}
        <Link href="/dictionary" asChild>
          <TouchableOpacity style={styles.button}>
            {/* 辞書アイコンを MaterialCommunityIcons の book-open-page-variant に変更 */}
            <MaterialCommunityIcons name="book-open-page-variant" size={32} color="#fff" />
            <Text style={styles.buttonText}>辞書検索</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/study" asChild>
          <TouchableOpacity style={styles.button}>
            <MaterialIcons name="school" size={32} color="#fff" />
            <Text style={styles.buttonText}>学習</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    width: '80%',
    gap: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
