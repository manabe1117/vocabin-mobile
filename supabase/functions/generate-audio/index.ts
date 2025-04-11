import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// リクエストボディのスキーマ定義
const requestBodySchema = z.object({
  text: z.string(),
  language: z.string().default('en'),
});

type RequestBody = z.infer<typeof requestBodySchema>;

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

    // リクエストボディのバリデーション
    const body = await req.json();
    const validatedBody = requestBodySchema.safeParse(body);
    if (!validatedBody.success) {
      throw new Error('Invalid request body');
    }

    const { text, language } = validatedBody.data;

    console.log(`[Audio Generation] リクエスト受信: text="${text}", language="${language}"`);

    // キャッシュを確認
    const { data: cacheData, error: cacheError } = await supabase
      .from('audio_cache')
      .select('url')
      .eq('text', text)
      .eq('language', language)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      throw cacheError;
    }

    if (cacheData) {
      console.log(`[Audio Generation] キャッシュヒット: text="${text}", language="${language}", url="${cacheData.url}"`);
      return new Response(JSON.stringify({ url: cacheData.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`[Audio Generation] キャッシュミス: text="${text}", language="${language}"`);

    // Google TTS APIを使用して音声を生成
    console.log(`[Audio Generation] Google TTS APIを呼び出し: text="${text}", language="${language}"`);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${language}&client=tw-ob`;
    const response = await fetch(ttsUrl);
    const audioBlob = await response.blob();

    // 音声ファイルをSupabaseストレージにアップロード
    const fileName = `${Date.now()}_${text}.mp3`;
    console.log(`[Audio Generation] ストレージへのアップロード開始: fileName="${fileName}"`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBlob, {
        contentType: 'audio/mpeg',
      });

    if (uploadError) {
      console.error(`[Audio Generation] ストレージアップロードエラー: ${uploadError.message}`);
      throw uploadError;
    }

    console.log(`[Audio Generation] ストレージアップロード成功: fileName="${fileName}"`);

    // アップロードしたファイルのURLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    // キャッシュに保存
    console.log(`[Audio Generation] キャッシュへの保存開始: text="${text}", language="${language}"`);
    const { error: insertError } = await supabase
      .from('audio_cache')
      .insert([
        {
          text,
          language,
          url: publicUrl,
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) {
      console.error(`[Audio Generation] キャッシュ保存エラー: ${insertError.message}`);
      throw insertError;
    }

    console.log(`[Audio Generation] キャッシュ保存成功: text="${text}", language="${language}", url="${publicUrl}"`);

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(`[Audio Generation] エラー発生: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 