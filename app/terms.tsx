import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/styles';
import { ScreenWrapper } from '@/components/ScreenWrapper';

export default function TermsScreen() {
  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.lastUpdated}>最終更新日: 2025年7月</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 本規約の適用</Text>
          <Text style={styles.paragraph}>
            本利用規約（以下「本規約」）は、当アプリ「Vocabin」（以下「本アプリ」）の利用に関する条件を定めるものです。
            本アプリをご利用いただく際は、本規約にご同意いただいたものとみなします。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. サービス概要</Text>
          <Text style={styles.paragraph}>
            本アプリは、語学学習を支援するためのサービスです。主な機能は以下の通りです：
          </Text>
          <Text style={styles.bulletPoint}>• 辞書機能</Text>
          <Text style={styles.bulletPoint}>• 学習機能</Text>
          <Text style={styles.bulletPoint}>• 学習進捗機能</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 利用登録</Text>
          <Text style={styles.paragraph}>
            本アプリの利用には、ユーザー登録が必要です。登録時に提供された情報は正確である必要があります。
            登録情報に変更があった場合は、速やかに更新してください。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. 禁止事項</Text>
          <Text style={styles.paragraph}>
            ユーザーは以下の行為を行ってはいけません：
          </Text>
          <Text style={styles.bulletPoint}>• 法令に違反する行為</Text>
          <Text style={styles.bulletPoint}>• 他のユーザーに迷惑をかける行為</Text>
          <Text style={styles.bulletPoint}>• 不正なアクセス・利用行為</Text>
          <Text style={styles.bulletPoint}>• 知的財産権を侵害する行為</Text>
          <Text style={styles.bulletPoint}>• 虚偽の情報を登録する行為</Text>
          <Text style={styles.bulletPoint}>• 商用利用（事前許可なく）</Text>
          <Text style={styles.bulletPoint}>• リバースエンジニアリング</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. アカウント管理</Text>
          <Text style={styles.paragraph}>
            ユーザーは自身のアカウント情報を適切に管理する責任があります。
            アカウントの不正利用が発覚した場合は、速やかにご連絡ください。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. 学習データの取り扱い</Text>
          <Text style={styles.paragraph}>
            ユーザーが入力した学習データ（単語、翻訳結果、学習記録など）は、サービス提供のために利用されます。
            これらのデータは、ユーザーの学習進捗管理、サービス改善、機能向上のために使用されます。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. サービスの変更・中断</Text>
          <Text style={styles.paragraph}>
            弊社は、事前の通知なく、本アプリの内容を変更または中断することがあります。
            システムメンテナンスや緊急事態等によるサービス中断については、可能な限り事前にお知らせします。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. 免責事項</Text>
          <Text style={styles.paragraph}>
            弊社は、本アプリの利用により生じた損害について、以下の場合を除き責任を負いません：
          </Text>
          <Text style={styles.bulletPoint}>• 弊社の故意または重過失による場合</Text>
          <Text style={styles.bulletPoint}>• 法令で定める場合</Text>
          <Text style={styles.paragraph}>
            翻訳結果の正確性については保証いたしません。重要な文書の翻訳は専門家にご相談ください。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. 個人情報の取り扱い</Text>
          <Text style={styles.paragraph}>
            個人情報の取り扱いについては、別途定める「プライバシーポリシー」をご確認ください。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. 利用規約の変更</Text>
          <Text style={styles.paragraph}>
            本規約は、法改正やサービス内容の変更に伴い、予告なく変更される場合があります。
            重要な変更がある場合は、アプリ内またはメールでお知らせします。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. お問い合わせ</Text>
          <Text style={styles.paragraph}>
            本規約に関するご質問やお問い合わせは、アプリ内のお問い合わせフォームからご連絡ください。
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