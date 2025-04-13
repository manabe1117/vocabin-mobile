// app/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Link href="/translate" asChild>
          <TouchableOpacity style={styles.button}>
            <MaterialIcons name="translate" size={32} color="#fff" />
            <Text style={styles.buttonText}>翻訳</Text>
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