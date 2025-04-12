import { corsHeaders } from '../_shared/cors-headers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// Supabaseクライアントの初期化
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

Deno.serve(async (req) => {
  // CORS preflight requestの処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authorization ヘッダーから JWT を取得
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }
    const token = authHeader.replace('Bearer ', '');

    // JWT を使用して認証
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;
    
    // リクエストボディからtypeとincludeAudioを取得
    const body = await req.json();
    const type = parseInt(body.type || '3');
    const includeAudio = body.includeAudio || false;

    // 音声データを含める場合は新しい関数を使用
    if (includeAudio) {
      const { data: flashcards, error } = await supabase.rpc('get_flashcards_with_audio', {
        p_user_id: userId,
        p_type: type
      });

      if (error) throw error;

      // 音声データがないカードに対して音声を生成
      const flashcardsWithAudio = await Promise.all(
        flashcards.map(async (card: any) => {
          if (card.audio_url) {
            return { ...card, audioData: card.audio_url };
          }

          try {
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(card.vocabulary)}&tl=en&client=tw-ob`;
            const response = await fetch(ttsUrl);
            const audioBlob = await response.blob();

            // 音声ファイルをSupabaseストレージにアップロード
            const fileName = `${Date.now()}_${card.vocabulary}.mp3`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('audio')
              .upload(fileName, audioBlob, {
                contentType: 'audio/mpeg',
              });

            if (uploadError) {
              console.error(`音声ファイルのアップロードに失敗: ${uploadError.message}`);
              return card;
            }

            // アップロードしたファイルのURLを取得
            const { data: { publicUrl } } = supabase.storage
              .from('audio')
              .getPublicUrl(fileName);

            // キャッシュに保存
            await supabase
              .from('audio_cache')
              .insert([
                {
                  text: card.vocabulary,
                  language: 'en',
                  url: publicUrl,
                  created_at: new Date().toISOString(),
                },
              ]);

            return { ...card, audioData: publicUrl };
          } catch (err) {
            console.error(`音声生成に失敗: ${err.message}`);
            return card;
          }
        })
      );

      return new Response(JSON.stringify(flashcardsWithAudio), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 音声データを含めない場合は従来の関数を使用
    const { data: flashcards, error } = await supabase.rpc('get_flashcards', {
      p_user_id: userId,
      p_type: type
    });

    if (error) throw error;

    return new Response(JSON.stringify(flashcards), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});