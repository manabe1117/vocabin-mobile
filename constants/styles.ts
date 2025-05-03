import { StyleSheet, Dimensions, Platform } from 'react-native';

// 画面の高さに基づいてカードの高さを計算
const screenHeight = Dimensions.get('window').height;
const topSectionHeight = 100;
const availableHeight = screenHeight - topSectionHeight;
const cardHeight = (availableHeight / 2) - 24;

export const COLORS = {
  // メインカラー
  PRIMARY: '#1a73e8',
  SECONDARY: '#4a90e2',
  
  // 状態カラー
  SUCCESS: {
    DEFAULT: '#77dd77',
    DARK: '#4caf50',
    DARKER: '#388e3c',
    LIGHT: '#27ae60',
  },
  WARNING: {
    DEFAULT: '#ff9800',
    DARK: '#f57c00',
  },
  ERROR: {
    DEFAULT: '#ff6961',
    DARK: '#e74c3c',
    DARKER: '#d93025',
    LIGHT: '#ff3b30',
  },
  INFO: {
    DEFAULT: '#3498db',
    DARK: '#2980b9',
    LIGHT: '#0a7ea4',  // tintColorLight from Colors.ts
  },
  
  // 学習状態カラー
  STUDY_STATUS: {
    COMPLETED: {
      TEXT: '#388e3c',  // SUCCESS.DARKER と同じ
      BACKGROUND: '#e8f5e9',
      BACKGROUND_LIGHT: '#f1f8e9',
    },
    IN_PROGRESS: {
      TEXT: '#f57c00',  // WARNING.DARK と同じ
      BACKGROUND: '#fff3e0',
      BACKGROUND_LIGHT: '#fff8e1',
    },
  },
  
  // テキストカラー
  TEXT: {
    PRIMARY: '#333',
    SECONDARY: '#666',
    LIGHT: '#777',
    LIGHTER: '#888',
    DARK: '#222',
    DARKER: '#212529',
    GRAY: '#5f6368',
    LIGHT_GRAY: '#6c757d',
    MEDIUM_GRAY: '#9e9e9e',
    DARK_GRAY: '#495057',
    DISABLED: '#bdbdbd',
    LINK: '#1a73e8',
    BLUE: '#0a7ea4',
    BLUE_LIGHT: '#1976d2',
    
    // ダークモード用
    DARK_MODE: '#ECEDEE',
    LIGHT_MODE: '#11181C',
  },
  
  // 基本色
  WHITE: '#fff',
  BLACK: '#000',
  
  // 背景色
  BACKGROUND: {
    MAIN: '#f8f9fa',
    LIGHT: '#f8f8ff',
    LIGHTER: '#f8f8f8',
    GRAY: '#f0f0f0',
    GRAY_LIGHT: '#e9ecef',
    GRAY_MEDIUM: '#e5e7eb',
    DARK_GRAY: '#e0e0e0',
    BLUE_LIGHT: '#e3f2fd',
    CARD: '#ffffff',
    
    // ダークモード用
    DARK: '#151718',
  },
  
  // ボーダー色
  BORDER: {
    LIGHT: '#dadce0',
    LIGHTER: '#eee',
    GRAY: '#e0e0e0',
    GRAY_LIGHT: '#e9ecef',
    BLUE: '#4a90e2',
  },
  
  // アイコン色
  ICON: {
    DEFAULT: '#5f6368',
    LIGHT: '#687076',
    DARK: '#9BA1A6',
    DISABLED: '#bdbdbd',
  },
  
  // タブ関連
  TAB: {
    DEFAULT: '#687076',
    SELECTED: {
      LIGHT: '#0a7ea4',
      DARK: '#fff',
    },
  },
  
  // その他効果
  EFFECTS: {
    RIPPLE: 'rgba(0, 0, 0, 0.1)',
    SHADOW: 'rgba(0, 0, 0, 0.3)',
    OVERLAY: 'rgba(0, 0, 0, 0.15)',
  },
  
  // ソーシャルメディア色
  SOCIAL: {
    GOOGLE: '#4285F4',
  },
  
  // 後方互換性のためのプロパティ
  CARD_BACKGROUND: '#ffffff',
  TEXT_PRIMARY: '#202124',
  TEXT_SECONDARY: '#5f6368',
  BACKGROUND_MAIN: '#f8f9fa',
  ERROR_DEFAULT: '#ff6961',
  SUCCESS_DEFAULT: '#77dd77',
} as const;

export const COMMON_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND.LIGHT,
    padding: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.ERROR.DEFAULT,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.SECONDARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.TEXT.LIGHT,
    marginTop: 50,
  },
});

export const TRANSLATE_STYLES = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'android' ? 10 : 20,
    paddingHorizontal: 16,
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
    height: 40,
  },
  languageButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COLORS.CARD_BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
    minWidth: 100,
    alignItems: 'center',
  },
  languageText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.PRIMARY,
  },
  swapButton: {
    padding: 8,
  },
  translationCardsContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: COLORS.CARD_BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
    padding: 16,
    justifyContent: 'space-between',
    height: cardHeight,
    overflow: 'hidden',
  },
  inputCard: {
    marginBottom: 16,
  },
  inputScrollView: {
    flex: 1,
    marginBottom: 10,
  },
  outputScrollView: {
    flex: 1,
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 20,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 28,
    minHeight: 50,
  },
  outputText: {
    fontSize: 20,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 28,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    marginTop: 'auto',
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  inlineLoader: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  outputCard: {
    // 出力カード固有のスタイルは不要
  },
}); 