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
const submitInquiryBodySchema = z.object({
  message: z.string().min(1, "メッセージは必須です。").max(2000, "メッセージは2000文字以内で入力してください。"),
});

type SubmitInquiryBody = z.infer<typeof submitInquiryBodySchema>;

Deno.serve(async (req) => {
  // CORSプリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      const validatedBody = submitInquiryBodySchema.safeParse(requestBody);

      if (!validatedBody.success) {
        console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
        return new Response(JSON.stringify({ 
          error: 'Invalid request body', 
          details: validatedBody.error.issues 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { message } = validatedBody.data;

      // inquiries テーブルにデータを挿入
      const { error: insertError } = await supabase
        .from('inquiries')
        .insert({
          user_id: userId,
          message: message,
          // status はDBのデフォルト値 (0) が使用される
        });

      if (insertError) {
        console.error('問い合わせの保存エラー:', insertError);
        return new Response(JSON.stringify({ 
          error: 'Failed to save inquiry', 
          details: insertError.message 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ 
        message: 'Inquiry submitted successfully' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    }

    // サポートされていないメソッド
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('予期せぬエラー:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 