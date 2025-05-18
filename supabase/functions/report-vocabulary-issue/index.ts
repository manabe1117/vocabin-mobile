import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";

// Supabaseのクライアント設定
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Supabase URLまたはService Role Keyが設定されていません。");
}

const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

// リクエストボディのスキーマ定義
const reportIssueBodySchema = z.object({
  vocabularyId: z.number().int().positive(),
  issueItems: z.array(z.string()).min(1, "問題のある項目を1つ以上選択してください。"),
  description: z.string().optional(),
});

type ReportIssueBody = z.infer<typeof reportIssueBodySchema>;

Deno.serve(async (req) => {
  // CORSプリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // POSTメソッドを許可
      },
    });
  }

  try {
    // AuthorizationヘッダーからJWTを取得
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.replace('Bearer ', '');

    // JWTを使用してユーザーを認証
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError?.message || 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userId = user.id;

    // POSTリクエストのみを処理
    if (req.method === 'POST') {
      const requestBody = await req.json();
      const validatedBody = reportIssueBodySchema.safeParse(requestBody);

      if (!validatedBody.success) {
        console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
        return new Response(JSON.stringify({ error: 'Invalid request body', details: validatedBody.error.issues }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { vocabularyId, issueItems, description } = validatedBody.data;

      // vocabulary_issue_reports テーブルにデータを挿入
      const { error: insertError } = await supabase
        .from('vocabulary_issue_reports') // schema.sql で定義したテーブル名
        .insert({
          user_id: userId,
          vocabulary_id: vocabularyId,
          issue_items: issueItems,
          description: description || null, // description がなければ null を設定
          // status はDBのデフォルト値 (0) が使用される
        });

      if (insertError) {
        console.error('問題報告の保存エラー:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save report', details: insertError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ message: 'Report submitted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201, // 作成成功
      });
    }

    // サポートされていないメソッド
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('予期せぬエラー:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 