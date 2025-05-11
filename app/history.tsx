import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

// 仮のスタイル定数 (本来は constants/styles.ts からインポート)
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

/**
 * 履歴アイテムの型定義
 * @property id - 履歴アイテムの一意なID
 * @property date - 表示用の日付文字列 (例: "2024年7月28日")
 * @property summary - 会話の簡単な要約
 * @property lastMessage - その会話の最後のメッセージの一部
 * @property messageCount - その会話に含まれるメッセージの総数
 */
interface HistoryItem {
  id: string;
  date: string;
  summary: string;
  lastMessage: string;
  messageCount: number;
}

// ダミーの履歴データ
const DUMMY_HISTORY_DATA: HistoryItem[] = [
  {
    id: '1',
    date: '2024年7月28日',
    summary: 'レストランでの注文練習',
    lastMessage: 'AI: かしこまりました。ご注文は以上でよろしいでしょうか？少々お待ちください。',
    messageCount: 12,
  },
  {
    id: '2',
    date: '2024年7月27日',
    summary: '週末の旅行計画について',
    lastMessage: 'User: おすすめの観光スポットと、そこへの行き方を教えてください。',
    messageCount: 25,
  },
  {
    id: '3',
    date: '2024年7月25日',
    summary: '英単語 "ambiguous" の意味と使い方',
    lastMessage: 'AI: "Ambigous" は「曖昧な」という意味です。例文をいくつか紹介しますね。',
    messageCount: 8,
  },
  {
    id: '4',
    date: '2024年7月24日',
    summary: '挨拶と天気に関する日常会話',
    lastMessage: 'User: こんにちは！今日はとても天気が良いですね！',
    messageCount: 30,
  },
  {
    id: '5',
    date: '2024年7月22日',
    summary: 'ビジネスメールの書き方と添削依頼',
    lastMessage: 'AI: 拝啓の部分をより丁寧な表現に修正しました。ご確認ください。',
    messageCount: 15,
  },
];

/**
 * チャット履歴画面コンポーネント
 * 過去のチャットセッションの一覧を表示します。
 */
const HistoryScreen = () => {
  /**
   * 履歴アイテムが選択された際の処理ハンドラ
   * @param item - 選択された履歴アイテム
   * @remarks 現時点ではアラートを表示するのみ。将来的には詳細画面へ遷移します。
   */
  const handleSelectHistory = (item: HistoryItem) => {
    // TODO: 実際の履歴詳細画面へのナビゲーションを実装する
    alert('「' + item.summary + '」の履歴が選択されました。\nID: ' + item.id);
  };

  /**
   * 個々の履歴アイテムをレンダリングする関数
   * @param item - 表示する履歴アイテムのデータ
   * @returns 履歴アイテムのJSX要素
   */
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
        <Text style={styles.historyItemSummary}>{item.summary}</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Link href="/chat" asChild>
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
        {DUMMY_HISTORY_DATA.map(renderHistoryItem)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND.MAIN,
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

export default HistoryScreen; 