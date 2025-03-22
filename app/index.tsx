// app/index.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAppContext } from '../context/AppContext'; // 状態管理を使う場合

const HomeScreen = () => {
  // const { userName } = useAppContext(); // 例: ユーザー名を取得 (状態管理から)
  const userName = "ユーザー"; //仮のユーザー名

  // ダミーの進捗データ (本来はAPIやストレージから読み込む)
  const studyTimeToday = '1時間';
  const completedPhrases = 10;
  const hasStudiedToday = true;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>こんにちは、{userName}さん！</Text>
      </View>

      <View style={styles.progressSection}>
        <Text style={styles.sectionTitle}>学習の進捗</Text>
        <View style={styles.progressItem}>
          <Text style={styles.progressLabel}>今日の学習時間:</Text>
          <Text style={styles.progressValue}>{studyTimeToday}</Text>
        </View>
        <View style={styles.progressItem}>
          <Text style={styles.progressLabel}>完了したフレーズ:</Text>
          <Text style={styles.progressValue}>{completedPhrases}個</Text>
        </View>
        {!hasStudiedToday && (
          <View style={styles.reminderSection}>
            <Text style={styles.reminderText}>今日はまだ学習していません</Text>
          </View>
        )}
      </View>
      {/*
      <View style={styles.recommendationSection}>
        <Text style={styles.sectionTitle}>おすすめのフレーズ</Text>
        <Text>おすすめのフレーズをここに表示</Text>
      </View>
       */}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  greetingSection: {
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  progressSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  progressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressLabel: {
    fontSize: 16,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  reminderSection:{
    backgroundColor: '#fff3cd',
    padding: 10,
    marginTop: 10,
    borderRadius: 5,
  },
  reminderText: {
    fontSize: 16,
    color: '#856404',
  },
  recommendationSection: {
    marginBottom: 20,
  },
});

export default HomeScreen;