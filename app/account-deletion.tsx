import React, { useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

export default function AccountDeletionScreen() {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAccountDeletion = async () => {
    try {
      setIsDeleting(true);
      
      // 現在のユーザーを取得
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('ユーザーが見つかりません');
      }

      // Edge Functionを呼び出し
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          '完了', 
          'アカウントデータが削除されました。\n\n注意: Googleアカウント自体は削除されません。Googleアカウントの削除が必要な場合は、Googleアカウント設定から行ってください。',
          [
            {
              text: 'OK',
              onPress: async () => {
                // ログアウト処理
                await supabase.auth.signOut();
                // ログイン画面に戻る
                router.replace('/auth/login');
              }
            }
          ]
        );
      } else {
        throw new Error(result.error || '削除に失敗しました');
      }
      
    } catch (error) {
      console.error('削除エラー:', error);
      const errorMessage = error instanceof Error ? error.message : 'アカウントの削除に失敗しました';
      Alert.alert('エラー', errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>アカウント削除</Text>
        
        <Text style={styles.description}>
          アカウントを削除すると、以下のデータが完全に削除されます：
        </Text>
        
        <View style={styles.dataListContainer}>
          <Text style={styles.dataListTitle}>削除されるデータ：</Text>
          <Text style={styles.dataList}>
            • 学習履歴と単語データ{'\n'}
            • 学習状況データ{'\n'}
            • 辞書検索履歴{'\n'}
            • レベル進捗{'\n'}
            • お問い合わせ履歴{'\n'}
            • ユーザープロフィール
          </Text>
          {/* 将来的に追加予定のデータ：
            • チャット履歴
            • 翻訳履歴  
            • 単語問題報告
          */}
        </View>

        <View style={styles.importantContainer}>
          <Text style={styles.importantTitle}>重要:</Text>
          <Text style={styles.importantText}>
            この操作により、Vocabinアプリ内のデータのみが削除されます。{'\n'}
            Googleアカウント自体は削除されません。
          </Text>
        </View>

        <Text style={styles.warning}>
          この操作は取り消すことができません。
        </Text>

        <Button 
          title={isDeleting ? "削除中..." : "アカウントデータを削除"} 
          onPress={handleAccountDeletion}
          disabled={isDeleting}
          color="#FF0000"
        />

        {isDeleting && (
          <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
        )}

        <Button 
          title="キャンセル" 
          onPress={() => router.back()}
          disabled={isDeleting}
          color="#666"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 22,
  },
  dataListContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  dataListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dataList: {
    fontSize: 14,
    lineHeight: 20,
  },
  importantContainer: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  importantTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 5,
  },
  importantText: {
    fontSize: 14,
    color: '#FF6B35',
    lineHeight: 20,
  },
  warning: {
    fontSize: 16,
    color: '#FF0000',
    marginBottom: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loader: {
    marginTop: 20,
    marginBottom: 20,
  },
});
