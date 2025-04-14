import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { Alert } from 'react-native';

/**
 * 音声データのインターフェース定義
 */
interface Voice {
  identifier: string; // 音声の一意な識別子
  language: string; // 音声の言語コード (例: 'en-US', 'ja-JP')
  name: string;     // 音声の名前 (例: 'Samantha', 'Kyoko')
}

/**
 * テキスト読み上げ用のカスタムフック
 */
export const useSpeech = () => {
  /**
   * テキストを読み上げる
   * @param text 読み上げるテキスト
   * @param lang 言語名 ('日本語', '英語')
   */
  const speakText = async (text: string, lang: string) => {
    if (!text) return; // テキストが空なら何もしない

    // 現在読み上げ中であれば停止する
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
      return;
    }

    // 言語名から適切な言語コード（BCP 47形式）を選択
    let languageCode = 'en-US'; // デフォルトは英語(アメリカ)
    if (lang === '日本語') languageCode = 'ja-JP';
    else if (lang === '英語') languageCode = 'en-US';

    try {
      const availableVoices = await Speech.getAvailableVoicesAsync();
      let voiceIdentifier: string | undefined;

      // OSごとに最適なVoiceを探す
      if (Platform.OS === 'ios') {
        if (languageCode === 'ja-JP') voiceIdentifier = availableVoices.find((v: Voice) => v.language === languageCode && v.name === 'Kyoko')?.identifier;
        else if (languageCode === 'en-US') voiceIdentifier = availableVoices.find((v: Voice) => v.language === languageCode && v.name === 'Samantha')?.identifier;
      }
      // 特定のVoiceが見つからない場合、言語コードの前半部分が一致する最初のVoiceを使用
      if (!voiceIdentifier) voiceIdentifier = availableVoices.find((v: Voice) => v.language.startsWith(languageCode.split('-')[0]))?.identifier;

      // テキスト読み上げを実行
      Speech.speak(text, { language: languageCode, voice: voiceIdentifier });
    } catch (speechError) {
      console.error("Speech error:", speechError);
      Alert.alert("音声エラー", "テキストの読み上げ中にエラーが発生しました。");
    }
  };

  return { speakText };
}; 