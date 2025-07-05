import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/styles';

export default function InquiryScreen() {
  const { session } = useAuth();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('エラー', 'メッセージを入力してください');
      return;
    }

    if (message.length > 2000) {
      Alert.alert('エラー', 'メッセージは2000文字以内で入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-inquiry`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            message: message.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '問い合わせの送信に失敗しました');
      }

      Alert.alert(
        '送信完了',
        'お問い合わせありがとうございます。\nアプリの改善に利用させていただきます。',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('問い合わせ送信エラー:', error);
      Alert.alert('エラー', error instanceof Error ? error.message : '問い合わせの送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.TEXT.PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.title}>問い合わせ</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>お問い合わせ内容</Text>
            <Text style={styles.description}>
              アプリの使い方、不具合報告、機能の要望など、お気軽にお問い合わせください。
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>メッセージ</Text>
            <TextInput
              style={styles.textInput}
              placeholder="お問い合わせ内容を入力してください"
              multiline
              numberOfLines={8}
              value={message}
              onChangeText={setMessage}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.characterCount}>
              {message.length}/2000文字
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? '送信中...' : '送信'}
            </Text>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              お問い合わせいただいた内容は、アプリの改善や機能追加の参考にさせていただきます。
              個人情報の取り扱いには十分注意いたします。
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 40,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT.PRIMARY,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHTER,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
    minHeight: 120,
  },
  characterCount: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    textAlign: 'right',
    marginTop: 5,
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.TEXT.SECONDARY,
  },
  submitButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    padding: 15,
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    borderRadius: 10,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    lineHeight: 20,
  },
}); 