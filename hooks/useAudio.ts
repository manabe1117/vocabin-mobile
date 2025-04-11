import { useState, useEffect } from 'react';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';

interface AudioCache {
  text: string;
  url: string;
  created_at: string;
}

export const useAudio = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playSound = async (text: string, language: string = 'en') => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      // Edge Functionを呼び出して音声URLを取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const { url } = await response.json();

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );
      setSound(newSound);
    } catch (error) {
      console.error('音声再生エラー:', error);
    }
  };

  return { playSound };
};