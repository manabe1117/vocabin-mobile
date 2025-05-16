import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from '../_shared/cors-headers.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    // Supabaseクライアントを初期化（サービスロールキーを使用）
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // JWT トークンでユーザー認証
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'User authentication failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId = user.id;

    // リクエストボディから sessionId を取得
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // セッションの所有者チェック（chat_sessionsテーブルがある場合はそちらでuser_id確認推奨）
    // chat_historiesにもuser_idがあるので、user_idでフィルタ
    const { data: messages, error: messagesError } = await supabaseClient
      .from('chat_histories')
      .select('id, message_id, sender, text_content, "timestamp", examples, rich_content, content_blocks, session_id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      return new Response(JSON.stringify({ error: messagesError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // クライアント用に整形
    const result = (messages ?? []).map(msg => ({
      id: msg.message_id, // フロントエンドは message_id を id として利用
      text: msg.text_content,
      sender: msg.sender,
      timestamp: msg.timestamp,
      examples: msg.examples,
      richContent: msg.rich_content,
      contentBlocks: msg.content_blocks,
      sessionId: msg.session_id,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});