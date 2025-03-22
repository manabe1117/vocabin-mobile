// hooks/useTranslation.ts
import { useState, useCallback } from 'react';

// 翻訳結果の型定義 (必要に応じて拡張)
interface TranslationResult {
  meaning: string;
  pronunciation: string;
  examples: string[];
  synonyms: string[];
  notes: string;
}

// カスタムフック
export const useTranslation = () => {
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 翻訳APIを叩く関数 (ダミー実装)
  const fetchTranslation = async (text: string): Promise<TranslationResult> => {
    // 本来はここにAPIリクエストを実装 (例: fetch, axios)
    //  const response = await fetch(`https://your-translation-api.com/translate?text=${text}`);
    //  const data = await response.json();

    // ダミーデータ (APIからのレスポンスを模倣)
    await new Promise((resolve) => setTimeout(resolve, 500)); // ローディングをシミュレート
    if (text.toLowerCase() === "error") {
      throw new Error("翻訳に失敗しました");
    }
    return {
      meaning: `「${text}」の意味（ダミー）`,
      pronunciation: '[ˈdʌmi]',
      examples: [`This is a dummy example for "${text}".`, `Another example of "${text}".`],
      synonyms: ['mock', 'fake', 'simulated'],
      notes: 'これはダミーの翻訳結果です。',
    };
  };

  // 翻訳を実行する関数
  const translate = useCallback(
    async (text: string) => {
      setLoading(true);
      setError(null);
      setTranslation(null);

      try {
        const result = await fetchTranslation(text);
        setTranslation(result);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { translation, loading, error, translate };
};