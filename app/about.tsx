import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '@/constants/styles';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <Text style={styles.appName}>Vocabin</Text>
          <Text style={styles.appTagline}>開発者が毎日使うアプリ</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリの概要</Text>
          <Text style={styles.paragraph}>
            Vocabinは、効率的な英語学習を支援するアプリです。
            辞書機能、学習機能、学習進捗機能を組み合わせて、
            あなたの英語力向上をサポートします。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>主な機能</Text>
          
          <View style={styles.featureItem}>
            <Ionicons name="book-outline" size={20} color={COLORS.TEXT.SECONDARY} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>辞書機能</Text>
              <Text style={styles.featureDescription}>
                辞書データベースやAI技術を活用して、単語の意味、発音、例文をリアルタイムで取得できます。
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="school-outline" size={20} color={COLORS.TEXT.SECONDARY} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>学習機能</Text>
              <Text style={styles.featureDescription}>
                単語帳、フラッシュカード、復習機能で効果的な学習を実現します。
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="analytics-outline" size={20} color={COLORS.TEXT.SECONDARY} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>学習進捗機能</Text>
              <Text style={styles.featureDescription}>
                学習の進捗状況を可視化し、モチベーションを維持できます。
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>開発について</Text>
          <Text style={styles.paragraph}>
            Vocabinは、開発者自身が使いたいと思う機能を実装しています。
            実際に使いながら必要だと感じた機能を追加しているため、今後も継続的に機能を拡張していく予定です。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリ情報</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>バージョン</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>リリース日</Text>
              <Text style={styles.infoValue}>2025年7月</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>対応OS</Text>
              <Text style={styles.infoValue}>Android</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>言語</Text>
              <Text style={styles.infoValue}>日本語</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>お問い合わせ</Text>
          <Text style={styles.paragraph}>
            アプリに関するご質問、ご要望、バグ報告などは、
            アプリ内のお問い合わせフォームからお気軽にご連絡ください。
          </Text>
          <TouchableOpacity 
            style={styles.contactButton} 
            onPress={() => router.push('/inquiry')}
          >
            <Ionicons name="mail-outline" size={20} color={COLORS.WHITE} />
            <Text style={styles.contactButtonText}>お問い合わせ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 Vocabin. All rights reserved.
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
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
    textAlign: 'center',
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
    lineHeight: 22,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureContent: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.TEXT.SECONDARY,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 4,
    marginLeft: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  contactButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER.LIGHTER,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.TEXT.SECONDARY,
  },
}); 