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
    console.log(`User ID: ${userId}`);

    const url = new URL(req.url);
    const type = parseInt(url.searchParams.get('type') || '2');
    console.log(`Type: ${type}`);

     // study_status と vocabulary テーブルを結合してデータを取得
    const { data, error } = await supabase
      .from('study_status')
      .select(`
        id,
        vocabulary_id,
        box_level,
        next_review_date,
        study_date,
        vocabulary (
          vocabulary,
          part_of_speech,
          example_sentences,
          meanings,
          synonyms,
          antonyms
        )
      `)
      .eq('user_id', userId) // ユーザーIDでフィルタリング
      .eq('delete_flg', false) // 論理削除されていないデータのみ取得
      .eq('is_completed', false) // 学習が完了していないデータのみ取得
      .eq('type', type) // type でフィルタリング
      // 変更: next_review_date を時刻も含めて比較
      .lte('next_review_date', new Date().toISOString()) // 次回復習予定日が今日以前のデータのみ取得
      .order('next_review_date', { ascending: true }) // 次回復習予定日が近い順に並べ替え
      .limit(50); // 取得件数を制限

    if (error) throw error;

    // 取得したデータをランダムに並べ替え
    if (data) {
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }
    }

    // 取得したデータを整形
    const flashcards = data.map((item) => ({
      id: item.id,
      vocabulary_id: item.vocabulary_id,
      vocabulary: item.vocabulary.vocabulary,
      part_of_speech: item.vocabulary.part_of_speech,
      meanings: item.vocabulary.meanings,
      examples: item.vocabulary.example_sentences.map((example: {en: string, ja: string}) => ({
        en: example.en,
        ja: example.ja,
      })),
      synonyms: item.vocabulary.synonyms,
      antonyms: item.vocabulary.antonyms,
      box_level: item.box_level,
      lastStudied: item.study_date, // 変更: study_date を lastStudied として返す
      reviewCount: 0, // 必要に応じて計算
    }));

    // レスポンスを返す
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