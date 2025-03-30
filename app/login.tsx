import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (error) {
      console.error('ログインエラー:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vocabin</Text>
      <Text style={styles.subtitle}>単語学習アプリ</Text>
      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
        <Text style={styles.buttonText}>Googleでログイン</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 