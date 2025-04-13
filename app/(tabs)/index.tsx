// app/(tabs)/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

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
  shadow: '#94a3b8', // 影の色
};

const HomeScreen = () => {
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {/* --- 言語ツールセクション --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>言語ツール</Text>
        <View style={styles.cardContainer}>
          {/* 辞書検索カード */}
          <Link href="/dictionary" asChild>
            <TouchableOpacity style={[styles.card, { width: cardWidth }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accentBlueLight }]}>
                <MaterialCommunityIcons name="book-open-page-variant" size={32} color={colors.accentBlue} />
              </View>
              <Text style={styles.cardTitle}>辞書</Text>
              {/* <Text style={styles.cardDescription}>単語や例文を検索</Text> */}
            </TouchableOpacity>
          </Link>

          {/* 翻訳カード */}
          <Link href="/translate" asChild>
            <TouchableOpacity style={[styles.card, { width: cardWidth }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accentGreenLight }]}>
                <MaterialIcons name="translate" size={32} color={colors.accentGreen} />
              </View>
              <Text style={styles.cardTitle}>翻訳</Text>
              {/* <Text style={styles.cardDescription}>テキストを翻訳</Text> */}
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* --- 学習セクション --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>学習</Text>
        <View style={styles.cardContainer}>
          {/* 学習カード */}
          <Link href="/study" asChild>
            <TouchableOpacity style={[styles.card, { width: cardWidth }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accentOrangeLight }]}>
                <MaterialIcons name="school" size={32} color={colors.accentOrange} />
              </View>
              <Text style={styles.cardTitle}>学習</Text>
              {/* <Text style={styles.cardDescription}>単語帳やクイズ</Text> */}
            </TouchableOpacity>
          </Link>
          {/* --- 将来的にカードを追加する場合のプレースホルダー --- */}
          {/* <View style={[styles.cardPlaceholder, { width: cardWidth }]} /> */}
        </View>
      </View>

      {/* --- 今後セクションが増える可能性を考慮 --- */}
      {/*
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>その他</Text>
        <View style={styles.cardContainer}>
          // 他のカード
        </View>
      </View>
      */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: containerPadding,
    paddingBottom: 50, // 下部のスクロール領域確保
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
    // textTransform: 'uppercase', // 大文字にする場合
    // letterSpacing: 0.5, // 文字間隔を少し広げる場合
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
  // カードの説明文を追加する場合のスタイル（オプション）
  /*
  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4, // タイトルとの間隔
    // textAlign: 'center', // 中央揃えに戻す場合
  },
  */
  // --- カードが1つしかない場合のプレースホルダー（オプション） ---
  /*
  cardPlaceholder: {
    // backgroundColor: 'transparent', // 背景なし
    // or
    // backgroundColor: '#eee', // 薄いグレーなど
    // borderRadius: 16,
    // borderWidth: 1,
    // borderColor: '#e2e8f0',
    // borderStyle: 'dashed',
  }
  */
});

export default HomeScreen;
