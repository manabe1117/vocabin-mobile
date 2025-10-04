import Constants from 'expo-constants';

/**
 * アプリケーション情報
 * app.jsonから自動的にバージョン情報を取得
 */
export const APP_INFO = {
  name: 'Vocabin',
  tagline: '開発者が毎日使うアプリ',
  version: Constants.expoConfig?.version || '1.0.0',
  releaseDate: '2025年7月',
  supportedOS: 'Android',
  language: '日本語',
  copyright: `© 2025 Vocabin. All rights reserved.`,
} as const;

