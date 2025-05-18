import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from '../_shared/cors-headers.ts';

// 環境変数から Supabase の URL とサービスロールキーを取得
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Supabase クライアントを初期化
const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

interface SearchHistoryEntry {
  vocabulary: string;
  searched_at: string;
}

Deno.serve(async (req: Request) => {
  // CORS プリフライトリクエスト (OPTIONS) の処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, OPTIONS', // GETメソッドを許可
      },
    });
  }

  // GET リクエスト以外のメソッドを拒否
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405, // Method Not Allowed
    });
  }

  try {
    // Authorization ヘッダーから JWT を取得
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.replace('Bearer ', '');

    // JWT を使用して認証
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId: string = user.id;

    // 辞書検索履歴を取得
    const { data, error: historyError } = await supabase
      .from('dictionary_search_history')
      .select('vocabulary, searched_at')
      .eq('user_id', userId)
      .order('searched_at', { ascending: false })
      .limit(30); // 最新30件に制限

    if (historyError) {
      console.error('Error fetching search history:', historyError);
      return new Response(JSON.stringify({ error: 'Failed to fetch search history', details: historyError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify(data as SearchHistoryEntry[]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: "An unexpected error occurred", details: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 