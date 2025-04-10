import { StyleSheet } from 'react-native';

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
  PRIMARY: '#4a90e2',
  SUCCESS: '#77dd77',
  ERROR: '#ff6961',
  TEXT: {
    PRIMARY: '#333',
    SECONDARY: '#666',
    LIGHT: '#777',
  },
  BACKGROUND: {
    PRIMARY: '#f8f8ff',
    SECONDARY: '#ffffff',
  },
} as const; 