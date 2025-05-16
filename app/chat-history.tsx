import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

const COLORS = {
  BACKGROUND: {
    MAIN: '#F4F6F8',
    LIGHT: '#FFFFFF',
  },
  TEXT: {
    PRIMARY: '#333333',
    SECONDARY: '#777777',
    LINK: '#007AFF',
  },
  BORDER: {
    LIGHT: '#E0E0E0',
  },
  PRIMARY: '#007AFF',
  WHITE: '#FFFFFF',
};

interface HistoryItem {
  id: string;
  date: string;
  summary: string;
  lastMessage: string;
  messageCount: number;
}

const ChatHistoryScreen = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth() as { session: any | null };
  const router = useRouter();
  const { id: sessionIdFromParams } = useLocalSearchParams<{ id?: string }>();

  const fetchHistory = async () => {
    if (!session?.user) {
      setError('ユーザーが認証されていません。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: historyData, error: functionError } = await supabase.functions.invoke(
        'get-chat-history'
      );
      if (functionError) {
        const errMsg = functionError.message || (typeof functionError === 'string' ? functionError : 'Function execution failed');
        if ((functionError as any).details) {
          console.error('Function error details:', (functionError as any).details);
        }
        throw new Error(errMsg);
      }
      if (Array.isArray(historyData)) {
        const transformedItems: HistoryItem[] = historyData.map((item: any) => ({
          id: item.id, 
          date: item.date,
          summary: item.summary || '要約なし',
          lastMessage: item.lastMessage || 'メッセージなし',
          messageCount: item.messageCount || 0,
        }));
        setHistoryItems(transformedItems);
      } else {
        console.warn('Unexpected data format from get-chat-history function. Expected array, got:', historyData);
        setHistoryItems([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch chat history via function:', e);
      const message = e.message || '不明なエラー';
      setError(`チャット履歴の取得に失敗しました。(${message})`);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (session) {
        fetchHistory();
      } else {
        setError('ユーザーが認証されていません。');
        setLoading(false);
      }
    }, [session])
  );

  const handleSelectHistory = (item: HistoryItem) => {
    router.push({
      pathname: "/chat",
      params: { id: item.id },
    });
  };

  const renderHistoryItem = (item: HistoryItem) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.historyItemContainer}
        onPress={() => handleSelectHistory(item)}
        activeOpacity={0.7}
      >
        <View style={styles.historyItemHeader}>
          <Text style={styles.historyItemDate}>{item.date}</Text>
          <View style={styles.messageCountBadge}>
            <Text style={styles.messageCountText}>{item.messageCount} 件</Text>
          </View>
        </View>
        <Text style={styles.historyItemSummary} numberOfLines={1} ellipsizeMode="tail">{item.summary.replace(/^ユーザー:|^User:/, 'You:')}</Text>
        <Text
          style={styles.historyItemLastMessage}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.lastMessage}
        </Text>
        <View style={styles.arrowIconContainer}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT.SECONDARY} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>履歴を読み込み中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.TEXT.SECONDARY} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (historyItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Link
            href={sessionIdFromParams ? { pathname: "/chat", params: { id: sessionIdFromParams } } : "/chat"}
            asChild
          >
            <TouchableOpacity style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          </Link>
          <Text style={styles.headerTitle}>チャット履歴</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={48} color={COLORS.TEXT.SECONDARY} />
          <Text style={styles.emptyText}>チャット履歴はありません。</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Link
          href={sessionIdFromParams ? { pathname: "/chat", params: { id: sessionIdFromParams } } : "/chat"}
          asChild
        >
          <TouchableOpacity style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
          </TouchableOpacity>
        </Link>
        <Text style={styles.headerTitle}>チャット履歴</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {historyItems.map(renderHistoryItem)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND.MAIN,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.BACKGROUND.MAIN,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHT,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT.PRIMARY,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  historyItemContainer: {
    backgroundColor: COLORS.BACKGROUND.LIGHT,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: Platform.OS === 'ios' ? 1 : 2,
    },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.08,
    shadowRadius: Platform.OS === 'ios' ? 3 : 2,
    elevation: Platform.OS === 'android' ? 3 : 0,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyItemDate: {
    fontSize: 13,
    color: COLORS.TEXT.SECONDARY,
    fontWeight: '500',
  },
  messageCountBadge: {
    backgroundColor: COLORS.PRIMARY + '20',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  messageCountText: {
    color: COLORS.PRIMARY,
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyItemSummary: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 8,
    lineHeight: 22,
    paddingRight: 32,
  },
  historyItemLastMessage: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 10,
    lineHeight: 20,
  },
  arrowIconContainer: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatHistoryScreen; 