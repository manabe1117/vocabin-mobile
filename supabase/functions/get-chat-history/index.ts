// Supabase クライアントライブラリをインポート
import { createClient } from "npm:@supabase/supabase-js";
// CORS ヘッダー設定をインポート
import { corsHeaders } from '../_shared/cors-headers.ts';

// クライアント側の HistoryItem と互換性のある型を定義
interface HistoryItemOutput {
  id: string;          // セッションID
  date: string;        // セッション作成日 (YYYY年M月D日 形式)
  summary: string;     // セッションの要約
  lastMessage: string; // 最新のメッセージ内容
  messageCount: number;// メッセージ総数
}

interface ChatSession {
  session_id: string;
  created_at: string;
  summary?: string | null;
}

// 最初のメッセージから要約を生成するヘルパー関数
async function generateSummaryFromFirstMessage(supabase: SupabaseClient, sessionId: string): Promise<string> {
  const { data: firstMsgData, error: firstMsgError } = await supabase
    .from('chat_histories')
    .select('text_content, sender')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstMsgError || !firstMsgData) {
    if (firstMsgError) console.error(`Error fetching first message for session ${sessionId} to generate summary:`, firstMsgError.message);
    return '会話の開始'; // デフォルトの要約
  }
  const prefix = firstMsgData.sender === 'user' ? 'User' : 'AI';
  const contentPreview = firstMsgData.text_content.substring(0, 30);
  return `${prefix}: ${contentPreview}${firstMsgData.text_content.length > 30 ? '...' : ''}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authorization ヘッダーから JWT を取得
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Authorization header is missing in get-chat-history');
      return new Response(JSON.stringify({ error: 'Authorization header is missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.replace('Bearer ', '');

    // Supabaseクライアントを初期化。サービスロールキーを使用。
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // JWT トークンを使用してユーザー認証
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error in get-chat-history:', authError?.message);
      return new Response(JSON.stringify({ error: 'User authentication failed: ' + (authError?.message || 'No user session') }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId = user.id;

    // 1. ユーザーのチャットセッションを取得 (最新のものから)
    const { data: sessions, error: sessionsError } = await supabaseClient
      .from('chat_sessions')
      .select('session_id, created_at, summary')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching chat sessions:', sessionsError.message);
      throw new Error('Failed to fetch chat sessions: ' + sessionsError.message);
    }

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify([]), { // 履歴がない場合は空配列を返す
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. 各セッションの詳細情報を取得し、HistoryItemOutput形式に整形
    const historyItems: HistoryItemOutput[] = await Promise.all(
      sessions.map(async (session: ChatSession) => {
        // メッセージ数と最新メッセージを取得
        const { count, error: countError } = await supabaseClient
          .from('chat_histories')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.session_id);

        const { data: lastMessageData, error: lastMessageError } = await supabaseClient
          .from('chat_histories')
          .select('text_content, sender')
          .eq('session_id', session.session_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (countError || lastMessageError) {
          console.error(`Error fetching message details for session ${session.session_id}:`, countError?.message || lastMessageError?.message);
          // エラー時はデフォルト値を設定して処理を継続
          const summary = session.summary || await generateSummaryFromFirstMessage(supabaseClient, session.session_id);
          return {
            id: session.session_id,
            date: new Date(session.created_at).toLocaleDateString('ja-JP'),
            summary: summary,
            lastMessage: 'メッセージ取得エラー',
            messageCount: 0,
          };
        }

        const messageCount = count || 0;
        let lastMessageText = 'メッセージなし';
        if (lastMessageData) {
          const prefix = lastMessageData.sender === 'user' ? 'User' : 'AI';
          const contentPreview = lastMessageData.text_content.substring(0, 50);
          lastMessageText = `${prefix}: ${contentPreview}${lastMessageData.text_content.length > 50 ? '...' : ''}`;
        }

        // 要約の処理 (セッションにsummaryがなければ最初のメッセージから生成)
        const summary = session.summary || await generateSummaryFromFirstMessage(supabaseClient, session.session_id);
        
        return {
          id: session.session_id,
          date: new Date(session.created_at).toLocaleDateString('ja-JP'),
          summary: summary,
          lastMessage: lastMessageText,
          messageCount: messageCount,
        };
      })
    );

    return new Response(JSON.stringify(historyItems), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('General error in get-chat-history function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message || 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 