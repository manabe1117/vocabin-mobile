import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/styles';
import { ScreenWrapper } from '@/components/ScreenWrapper';

export default function PrivacyScreen() {
  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.lastUpdated}>最終更新日: 2025年8月</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 収集する情報</Text>
          <Text style={styles.paragraph}>
            当アプリは以下の情報を収集します：
          </Text>
          <Text style={styles.bulletPoint}>• アカウント情報（ユーザーID、パスワード）</Text>
          <Text style={styles.bulletPoint}>• 学習データ（単語帳、翻訳履歴、学習進捗）</Text>
          <Text style={styles.bulletPoint}>• 翻訳したいテキスト</Text>
          <Text style={styles.bulletPoint}>• アプリの使用状況</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. カメラ機能について</Text>
          <Text style={styles.paragraph}>
            翻訳機能で画像内のテキストを認識するためにカメラへのアクセス許可を要求します。
            （この機能は現在開発中で、将来的に実装予定です）
          </Text>
          <Text style={styles.bulletPoint}>• 撮影された画像からテキストを抽出して翻訳</Text>
          <Text style={styles.bulletPoint}>• 画像データは処理完了後に自動的に削除</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 音声機能について</Text>
          <Text style={styles.paragraph}>
            音声入力を文字に変換するためにマイクへのアクセス許可を要求します。
          </Text>
          <Text style={styles.bulletPoint}>• 音声を文字に変換して翻訳</Text>
          <Text style={styles.bulletPoint}>• 音声データは処理完了後に自動的に削除</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. 情報の利用目的</Text>
          <Text style={styles.paragraph}>
            収集した情報は以下の目的で利用します：
          </Text>
          <Text style={styles.bulletPoint}>• 翻訳サービスの提供</Text>
          <Text style={styles.bulletPoint}>• 学習データの保存・同期</Text>
          <Text style={styles.bulletPoint}>• サービスの改善</Text>
          <Text style={styles.bulletPoint}>• サポートの提供</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. 情報の共有</Text>
          <Text style={styles.paragraph}>
            以下の場合を除き、個人情報を第三者に提供しません：
          </Text>
          <Text style={styles.bulletPoint}>• ユーザーの同意がある場合</Text>
          <Text style={styles.bulletPoint}>• 法令に基づく要求がある場合</Text>
          <Text style={styles.bulletPoint}>• サービス提供に必要な外部サービスへの提供</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. データの保管とセキュリティ</Text>
          <Text style={styles.paragraph}>
            個人情報は適切なセキュリティ対策を講じて安全に保管されます。
          </Text>
          <Text style={styles.bulletPoint}>• 暗号化された通信でデータを送受信</Text>
          <Text style={styles.bulletPoint}>• アクセス制限による保護</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. データの保持期間</Text>
          <Text style={styles.paragraph}>
            データの種類に応じて以下の期間保持されます：
          </Text>
          <Text style={styles.bulletPoint}>• アカウント情報・学習データ：アカウント削除まで</Text>
          <Text style={styles.bulletPoint}>• 翻訳・音声・画像データ：処理完了後、即座に削除</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. ユーザーの権利</Text>
          <Text style={styles.paragraph}>
            ユーザーは以下の権利を有します：
          </Text>
          <Text style={styles.bulletPoint}>• 個人情報の確認・訂正・削除</Text>
          <Text style={styles.bulletPoint}>• アカウントの削除</Text>
          <Text style={styles.bulletPoint}>• 学習データの削除</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. プライバシーポリシーの変更</Text>
          <Text style={styles.paragraph}>
            重要な変更がある場合は、アプリ内でお知らせします。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. お問い合わせ</Text>
          <Text style={styles.paragraph}>
            ご質問やお問い合わせは、アプリ内のお問い合わせフォームからご連絡ください。
          </Text>
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