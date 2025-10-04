import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '@/constants/styles';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { isAdmin } = useFeatureFlags();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>アカウント</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント情報</Text>
          <View style={styles.infoCard}>
            <Text style={styles.label}>メールアドレス</Text>
            <Text style={styles.value}>{session?.user?.email}</Text>
          </View>
        </View>

        {/* 管理者向けセクション */}
        {/* {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>管理者メニュー</Text>
            <TouchableOpacity style={styles.settingItem} onPress={() => alert('管理者向けの機能管理画面は開発中です')}>
              <Ionicons name="settings-outline" size={24} color={COLORS.TEXT.SECONDARY} />
              <Text style={styles.settingText}>機能管理</Text>
            </TouchableOpacity>
          </View>
        )} */}

        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/inquiry')}>
          <Ionicons name="send-outline" size={24} color={COLORS.TEXT.SECONDARY} />
          <Text style={styles.settingText}>お問い合わせ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/help')}>
          <Ionicons name="help-circle-outline" size={24} color={COLORS.TEXT.SECONDARY} />
          <Text style={styles.settingText}>ヘルプとサポート</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/about')}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.TEXT.SECONDARY} />
          <Text style={styles.settingText}>アプリについて</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountButton} onPress={() => router.push('/account-deletion')}>
          <Text style={styles.deleteAccountText}>アカウント削除</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
  infoCard: {
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    padding: 15,
    borderRadius: 10,
  },
  label: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
  },
  settingText: {
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
    marginLeft: 15,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  logoutButton: {
    margin: 20,
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.ERROR.DARKER,
    fontSize: 14,
    fontWeight: '500',
  },
  deleteAccountButton: {
    margin: 20,
    marginTop: 8,
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteAccountText: {
    color: COLORS.ERROR.DARKER,
    fontSize: 14,
    fontWeight: '500',
  },
}); 