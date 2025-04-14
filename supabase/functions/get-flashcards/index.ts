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
    
    // リクエストボディからtypeを取得
    const body = await req.json();
    const type = parseInt(body.type || '3');

    // フラッシュカードを取得
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