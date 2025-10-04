// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { ScreenWrapper } from '../../components/ScreenWrapper';

// --- Layout Constants ---
const { width } = Dimensions.get('window');
const containerPadding = 24; // 少し広めに
const cardGap = 16; // カード間のギャップ
// 画面幅から適切なカード幅を計算 (左右パディングとカード間ギャップを考慮)
const cardWidth = (width - containerPadding * 2 - cardGap) / 2;

// --- Color Palette (Modern & Soft) ---
const colors = {
  background: '#f7f8fc', // わずかに青みがかった白
  cardBackground: '#ffffff',
  textPrimary: '#2d3748', // 濃いグレー (メインテキスト)
  textSecondary: '#718096', // やや薄いグレー (サブテキスト、セクションタイトルなど)
  accentBlue: '#3b82f6', // 青系のアクセント
  accentBlueLight: '#eff6ff', // 青系の薄い背景
  accentGreen: '#10b981', // 緑系のアクセント
  accentGreenLight: '#f0fdf4', // 緑系の薄い背景
  accentOrange: '#f97316', // オレンジ系のアクセント
  accentOrangeLight: '#fff7ed', // オレンジ系の薄い背景
  accentPurple: '#8b5cf6', // 紫系のアクセント
  accentPurpleLight: '#f5f3ff', // 紫系の薄い背景
  shadow: '#94a3b8', // 影の色
  aiQuestionBackground: '#4f46e5', // AI質問カード用の特別な背景色 (例: Indigo)
  aiQuestionText: '#ffffff', // AI質問カード用のテキスト色
};

const HomeScreen = () => {
  const { session } = useAuth();
  const { canAccessFeature, isAdmin } = useFeatureFlags();
  const router = useRouter();
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [learningCount, setLearningCount] = useState<number | null>(null);
  const [studyCount, setStudyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const fetchCounts = async () => {
        if (!session?.access_token) return;
        setLoading(true);
        setError(null);
        try {
          // 学習状況の件数を取得
          const { data: studyStatusData, error: studyStatusError } = await supabase.functions.invoke('count-study-status', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (studyStatusError) throw studyStatusError;
          setCompletedCount(studyStatusData.completedCount ?? 0);
          setLearningCount(studyStatusData.learningCount ?? 0);
          // 学習する単語の件数を取得
          const { data: studyCountData, error: studyCountError } = await supabase.functions.invoke('get-study-count', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (studyCountError) throw studyCountError;
          setStudyCount(studyCountData.count ?? 0);
        } catch (e: any) {
          setError(e.message || '件数の取得に失敗しました');
        } finally {
          setLoading(false);
        }
      };
      fetchCounts();
    }, [session?.access_token])
  );

  // 学習状態ごとに単語帳画面に遷移する関数
  const navigateToVocabularyWithFilter = (studyStatus: '学習済み' | '学習中') => {
    router.push({
      pathname: '/vocabulary',
      params: { studyStatus }
    });
  };

  return (
    <ScreenWrapper 
      style={styles.scrollView} 
      contentContainerStyle={styles.container}
      bottomPadding={50}
    >
      {/* --- フレーズ統計バー --- */}
      <View style={styles.statsBar}>
        <TouchableOpacity 
          style={styles.statsItem}
          onPress={() => navigateToVocabularyWithFilter('学習済み')}
          disabled={loading || !!error || (completedCount === 0)}
        >
          <View style={styles.statsLabelRow}>
            <MaterialIcons name="check-circle" size={24} color={colors.accentGreen} style={styles.statsIcon} />
            <Text style={styles.statsLabel}>学習済み</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accentGreen} />
          ) : error ? (
            <Text style={{ color: 'red', fontSize: 12 }}>取得失敗</Text>
          ) : (
            <Text style={styles.statsValue}>{completedCount}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.statsDivider} />
        <TouchableOpacity 
          style={styles.statsItem}
          onPress={() => navigateToVocabularyWithFilter('学習中')}
          disabled={loading || !!error || (learningCount === 0)}
        >
          <View style={styles.statsLabelRow}>
            <MaterialIcons name="hourglass-bottom" size={24} color={colors.accentOrange} style={styles.statsIcon} />
            <Text style={styles.statsLabel}>学習中</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accentOrange} />
          ) : error ? (
            <Text style={{ color: 'red', fontSize: 12 }}>取得失敗</Text>
          ) : (
            <Text style={styles.statsValue}>{learningCount}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isAdmin ? (
        <>
          {/* --- AIに質問セクション --- */}
          {canAccessFeature('chat') && (
            <View style={styles.aiSection}>
              <Link href="/chat" asChild>
                <TouchableOpacity style={styles.aiCard}>
                  <View style={styles.aiIconContainer}>
                    <Ionicons name="sparkles" size={32} color={colors.aiQuestionText} />
                  </View>
                  <View style={styles.aiTextContainer}>
                    <Text style={styles.aiCardTitle}>AIに質問</Text>
                    <Text style={styles.aiCardDescription}>英語学習に関する疑問をAIに相談できます</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={colors.aiQuestionText} style={styles.aiChevron} />
                </TouchableOpacity>
              </Link>
            </View>
          )}

          {/* --- 言語ツールセクション --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>言語ツール</Text>
            <View style={styles.cardContainer}>
              {/* 辞書検索カード */}
              {canAccessFeature('dictionary') && (
                <Link href="/dictionary" asChild>
                  <TouchableOpacity style={[styles.card, { width: cardWidth }]}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentBlueLight }]}>
                      <MaterialCommunityIcons name="book-open-page-variant" size={32} color={colors.accentBlue} />
                    </View>
                    <Text style={styles.cardTitle}>辞書</Text>
                  </TouchableOpacity>
                </Link>
              )}

              {/* 翻訳カード */}
              {canAccessFeature('translate') && (
                <Link href="/translate" asChild>
                  <TouchableOpacity style={[styles.card, { width: cardWidth }]}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentGreenLight }]}>
                      <MaterialIcons name="translate" size={32} color={colors.accentGreen} />
                    </View>
                    <Text style={styles.cardTitle}>翻訳</Text>
                  </TouchableOpacity>
                </Link>
              )}

              {/* 単語帳カード */}
              <Link href="/vocabulary" asChild>
                <TouchableOpacity style={[styles.card, { width: cardWidth }]}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.accentOrangeLight }]}>
                    <Ionicons name="book" size={32} color={colors.accentOrange} />
                  </View>
                  <Text style={styles.cardTitle}>単語帳</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          {/* --- 学習セクション --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>学習</Text>
            <View style={styles.cardContainer}>
              {/* 学習カード */}
              {canAccessFeature('study') && (
                <Link href="/study" asChild>
                  <TouchableOpacity style={[styles.card, { width: cardWidth }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.accentOrangeLight }]}>
                        <MaterialIcons name="school" size={32} color={colors.accentOrange} />
                      </View>
                      {/* 学習件数バッジ */}
                      {!loading && !error && studyCount !== null && studyCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{studyCount}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardTitle}>学習</Text>
                  </TouchableOpacity>
                </Link>
              )}
            </View>
          </View>
        </>
      ) : (
        /* --- 一般ユーザー向け大きなボタン --- */
        <View style={styles.section}>
          <View style={styles.largeButtonContainer}>
            {/* 辞書検索カード（大） */}
            {canAccessFeature('dictionary') && (
              <Link href="/dictionary" asChild>
                <TouchableOpacity style={styles.largeCardDictionary}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={48} color={colors.accentBlue} style={styles.largeIcon} />
                  <Text style={styles.largeCardTitle}>辞書検索</Text>
                  <Text style={styles.largeCardDescription}>単語やフレーズの意味を調べる</Text>
                </TouchableOpacity>
              </Link>
            )}

            {/* 学習カード（大） */}
            {canAccessFeature('study') && (
              <Link href="/study" asChild>
                <TouchableOpacity style={styles.largeCardStudy}>
                  <MaterialIcons name="school" size={48} color={colors.accentOrange} style={styles.largeIcon} />
                  <Text style={styles.largeCardTitle}>学習</Text>
                  <Text style={styles.largeCardDescription}>フラッシュカードで単語やフレーズを覚える</Text>
                  {/* 学習件数バッジ */}
                  {!loading && !error && studyCount !== null && studyCount > 0 && (
                    <View style={[styles.badge, styles.largeBadge]}>
                      <Text style={styles.largeBadgeText}>{studyCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Link>
            )}
          </View>
        </View>
      )}
      {/* 広告は非表示にしました */}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: containerPadding,
    gap: 32, // セクション間のギャップを広めに
  },
  section: {
    gap: 16, // セクションタイトルとカードコンテナの間隔
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600', // Semi-bold
    color: colors.textSecondary,
    marginLeft: 4, // 少しインデント
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: cardGap, // カード間の水平・垂直ギャップ
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16, // 角丸を大きく
    padding: 20, // 内側のパディング
    alignItems: 'flex-start', // 左揃えに変更
    justifyContent: 'space-between', // アイコンとテキストを上下に配置しやすく
    gap: 12, // アイコンサークルとテキストの間の垂直ギャップ
    // より繊細な影
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, // 透明度を低く
    shadowRadius: 12, // ぼかし半径を大きく
    elevation: 3, // Android用の影
    minHeight: 160, // カードの高さを確保
  },
  iconCircle: {
    width: 60, // アイコン円のサイズを少し調整
    height: 60,
    borderRadius: 30, // 半径
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8, // アイコンとタイトルの間のマージン
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600', // Semi-bold
    color: colors.textPrimary,
    textAlign: 'center', // 中央揃えに戻す場合
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 0,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 0,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statsIcon: {
    marginRight: 2,
  },
  statsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  statsDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
    borderRadius: 1,
  },
  statsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  // --- AIに質問セクションのスタイル ---
  aiSection: {
    // セクション全体のマージンやパディングは他のセクションと合わせるか、個別に調整
    marginTop: -8,// statsBarとの間隔を詰めるためにネガティブマージンを追加
  },
  aiCard: {
    backgroundColor: colors.aiQuestionBackground,
    borderRadius: 16,
    paddingVertical: 24, // 縦のパディングを少し大きめに
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 }, // 影を少し強く
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  aiIconContainer: {
    // アイコンコンテナのスタイル（必要であれば）
    marginRight: 16,
  },
  aiTextContainer: {
    flex: 1, // テキストが長くなった場合に対応
  },
  aiCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.aiQuestionText,
    marginBottom: 4,
  },
  aiCardDescription: {
    fontSize: 14,
    color: colors.aiQuestionText,
    opacity: 0.9, // 少し透明度を出す
  },
  aiChevron: {
    // 右向きシェブロンのスタイル
  },
  // --- 学習カードのバッジスタイル ---
  cardHeader: {
    position: 'relative',
    alignItems: 'flex-start',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.cardBackground,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  largeButtonContainer: {
    gap: 16,
    alignItems: 'center',
  },
  largeCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    minHeight: 160,
  },
  largeCardDictionary: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    minHeight: 180,
    backgroundColor: colors.accentBlueLight,
  },
  largeCardStudy: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    minHeight: 180,
    backgroundColor: colors.accentOrangeLight,
  },
  largeCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',

  },
  largeCardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  largeBadge: {
    top: 16,
    right: 16,
    borderColor: colors.accentOrangeLight,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
  },
  largeBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  largeIcon: {
    marginBottom: 12,
  },
});

export default HomeScreen;

