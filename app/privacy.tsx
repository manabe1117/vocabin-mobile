import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '@/constants/styles';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.lastUpdated}>最終更新日: 2025年7月</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 収集する情報</Text>
          <Text style={styles.paragraph}>
            当アプリは以下の情報を収集します：
          </Text>
          <Text style={styles.bulletPoint}>• アカウント情報（メールアドレス）</Text>
          <Text style={styles.bulletPoint}>• 学習データ（単語帳、翻訳履歴、学習進捗）</Text>
          <Text style={styles.bulletPoint}>• 使用統計情報（アプリの使用頻度、機能の利用状況）</Text>
          <Text style={styles.bulletPoint}>• デバイス情報（OS、アプリバージョン）</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 情報の利用目的</Text>
          <Text style={styles.paragraph}>
            収集した情報は以下の目的で利用します：
          </Text>
          <Text style={styles.bulletPoint}>• サービスの提供・運営</Text>
          <Text style={styles.bulletPoint}>• 学習データの同期・バックアップ</Text>
          <Text style={styles.bulletPoint}>• サービスの改善・機能開発</Text>
          <Text style={styles.bulletPoint}>• カスタマーサポートの提供</Text>
          <Text style={styles.bulletPoint}>• 利用状況の分析</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 情報の共有</Text>
          <Text style={styles.paragraph}>
            当社は、以下の場合を除き、個人情報を第三者に提供しません：
          </Text>
          <Text style={styles.bulletPoint}>• ユーザーの同意がある場合</Text>
          <Text style={styles.bulletPoint}>• 法的義務による場合</Text>
          <Text style={styles.bulletPoint}>• サービス提供に必要な業務委託先への提供</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. データの保管</Text>
          <Text style={styles.paragraph}>
            ユーザーの個人情報は、適切なセキュリティ対策を講じた上で、安全に保管されます。
            不要になった情報は適切に削除されます。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. ユーザーの権利</Text>
          <Text style={styles.paragraph}>
            ユーザーは以下の権利を有します：
          </Text>
          <Text style={styles.bulletPoint}>• 個人情報の開示請求</Text>
          <Text style={styles.bulletPoint}>• 個人情報の訂正・削除請求</Text>
          <Text style={styles.bulletPoint}>• 個人情報の利用停止請求</Text>
          <Text style={styles.bulletPoint}>• アカウントの削除</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. プライバシーポリシーの変更</Text>
          <Text style={styles.paragraph}>
            当プライバシーポリシーは、法改正やサービス内容の変更に伴い、予告なく変更される場合があります。
            重要な変更がある場合は、アプリ内またはメールでお知らせします。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. お問い合わせ</Text>
          <Text style={styles.paragraph}>
            プライバシーポリシーに関するご質問やお問い合わせは、アプリ内のお問い合わせフォームからご連絡ください。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.TEXT.PRIMARY,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 4,
    marginLeft: 8,
  },
}); 