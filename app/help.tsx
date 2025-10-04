import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { COLORS } from '@/constants/styles';
import { APP_INFO } from '@/constants/appInfo';
import { ScreenWrapper } from '@/components/ScreenWrapper';

export default function HelpScreen() {
  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>よくある質問</Text>
        
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Q. 単語帳の使い方は？</Text>
          <Text style={styles.faqAnswer}>
            A. 単語帳では、学習した単語を復習できます。スワイプで「覚えた」「まだ覚えていない」を選択し、効率的に学習を進めましょう。
          </Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Q. 翻訳機能の使い方は？</Text>
          <Text style={styles.faqAnswer}>
            A. 翻訳画面でテキストを入力するか、音声入力、カメラ入力を使用して翻訳できます。翻訳結果は自動的に単語帳に保存されます。
          </Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Q. 学習進捗はどこで確認できますか？</Text>
          <Text style={styles.faqAnswer}>
            A. ホーム画面で学習進捗を確認できます。今日の学習数や全体の学習状況が表示されます。
          </Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Q. データの同期について</Text>
          <Text style={styles.faqAnswer}>
            A. アカウントにログインすることで、学習データは自動的にクラウドに保存され、複数のデバイス間で同期されます。
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>お困りの場合</Text>
        
        <TouchableOpacity style={styles.helpItem} onPress={() => router.push('/inquiry')}>
          <Ionicons name="mail-outline" size={24} color={COLORS.TEXT.SECONDARY} />
          <View style={styles.helpItemContent}>
            <Text style={styles.helpItemTitle}>お問い合わせ</Text>
            <Text style={styles.helpItemDescription}>
              アプリの使い方やトラブルについてお気軽にお問い合わせください
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT.SECONDARY} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.helpItem} 
          onPress={() => router.push('/privacy')}
        >
          <Ionicons name="shield-outline" size={24} color={COLORS.TEXT.SECONDARY} />
          <View style={styles.helpItemContent}>
            <Text style={styles.helpItemTitle}>プライバシーポリシー</Text>
            <Text style={styles.helpItemDescription}>
              個人情報の取り扱いについて
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT.SECONDARY} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.helpItem} 
          onPress={() => router.push('/terms')}
        >
          <Ionicons name="document-text-outline" size={24} color={COLORS.TEXT.SECONDARY} />
          <View style={styles.helpItemContent}>
            <Text style={styles.helpItemTitle}>利用規約</Text>
            <Text style={styles.helpItemDescription}>
              アプリの利用規約について
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT.SECONDARY} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アプリ情報</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>バージョン</Text>
          <Text style={styles.infoValue}>{APP_INFO.version}</Text>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },

  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: COLORS.TEXT.PRIMARY,
  },
  faqItem: {
    marginBottom: 20,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: COLORS.TEXT.PRIMARY,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.TEXT.SECONDARY,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
  },
  helpItemContent: {
    flex: 1,
    marginLeft: 15,
  },
  helpItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 4,
  },
  helpItemDescription: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
  },
}); 