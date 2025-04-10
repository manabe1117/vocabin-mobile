import { useState, useEffect } from 'react';
import { Audio } from 'expo-av';

export const useAudio = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playSound = async (text: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob` },
        { shouldPlay: true }
      );
      setSound(newSound);
    } catch (error) {
      console.error('音声再生エラー:', error);
    }
  };

  return { playSound };
}; 