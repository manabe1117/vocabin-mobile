import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts"; 
import { add } from "https://esm.sh/date-fns@2.30.0";

interface StudyStatus {
  id: string;
  user_id: string;
  vocabulary_id: number;
  created_at: string;
  box_level: number;
  next_review_date: string;
  delete_flg: boolean;
  updated_at: string;
  type: number; // type を追加
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// リクエストボディの型定義 (GET, POST 用)
const requestBodySchema = z.object({
  vocabularyId: z.number(),
  type: z.number(), // type を追加
});
type RequestBody = z.infer<typeof requestBodySchema>;

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET',
      },
    });
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

    // GET リクエスト (保存状態の確認)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const vocabularyId = parseInt(url.searchParams.get('vocabularyId') || '');
      const type = parseInt(url.searchParams.get('type') || '');

      if (!vocabularyId || !type) {
        throw new Error('vocabularyId and type are required');
      }

      const { data, error } = await supabase
        .from<StudyStatus>('study_status')
        .select('id')
        .eq('user_id', userId)
        .eq('vocabulary_id', vocabularyId)
        .eq('type', type) // type を追加
        .eq('delete_flg', false) // 削除フラグが false のものを取得
        .limit(1);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ isSaved: data.length > 0 }), // data が存在すれば true, 存在しなければ(null) false
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error('Invalid request method');
  } catch (error) {
    console.error('予期せぬエラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});