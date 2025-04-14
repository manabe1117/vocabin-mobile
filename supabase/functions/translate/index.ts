import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// リクエストボディのスキーマ定義
const requestBodySchema = z.object({
  text: z.string(),
  sourceLang: z.string(),
  targetLang: z.string(),
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

    const { text, sourceLang, targetLang } = validatedBody.data;

    // 言語コードの変換
    const getLanguageCode = (lang: string): string => {
      switch (lang) {
        case '日本語':
          return 'ja';
        case '英語':
          return 'en';
        default:
          return 'en';
      }
    };

    const sourceCode = getLanguageCode(sourceLang);
    const targetCode = getLanguageCode(targetLang);

    // Google Cloud Translation APIを使用して翻訳
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${Deno.env.get('GOOGLE_TRANSLATE_API_KEY')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceCode,
          target: targetCode,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Translation API request failed');
    }

    const data = await response.json();
    const translatedText = data.data.translations[0].translatedText;

    return new Response(JSON.stringify({ translatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 