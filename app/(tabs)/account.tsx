import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '@/constants/styles';

export default function AccountScreen() {
  const { session, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
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

      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/inquiry')}>
        <Ionicons name="send-outline" size={24} color={COLORS.TEXT.SECONDARY} />
        <Text style={styles.settingText}>問い合わせ</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/help')}>
        <Ionicons name="help-circle-outline" size={24} color={COLORS.TEXT.SECONDARY} />
        <Text style={styles.settingText}>ヘルプとサポート</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/about')}>
        <Ionicons name="information-circle-outline" size={24} color={COLORS.TEXT.SECONDARY} />
        <Text style={styles.settingText}>アプリについて</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
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
  logoutButton: {
    margin: 20,
    padding: 15,
    backgroundColor: COLORS.ERROR.LIGHT,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
}); 