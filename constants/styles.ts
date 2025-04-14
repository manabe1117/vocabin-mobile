import { StyleSheet, Dimensions, Platform } from 'react-native';

// 画面の高さに基づいてカードの高さを計算
const screenHeight = Dimensions.get('window').height;
const topSectionHeight = 100;
const availableHeight = screenHeight - topSectionHeight;
const cardHeight = (availableHeight / 2) - 24;

export const COMMON_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8ff',
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
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6961',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#777',
    marginTop: 50,
  },
});

export const COLORS = {
  PRIMARY: '#1a73e8',
  SUCCESS: '#77dd77',
  ERROR: '#ff6961',
  TEXT: {
    PRIMARY: '#333',
    SECONDARY: '#666',
    LIGHT: '#777',
  },
  BACKGROUND: '#f8f9fa',
  CARD_BACKGROUND: '#ffffff',
  TEXT_PRIMARY: '#202124',
  TEXT_SECONDARY: '#5f6368',
  ICON: '#5f6368',
  BORDER: '#dadce0',
  RIPPLE: 'rgba(0, 0, 0, 0.1)',
} as const;

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
    borderColor: COLORS.BORDER,
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
    borderColor: COLORS.BORDER,
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