// Supabase クライアントライブラリをインポート
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
// CORS ヘッダー設定をインポート
import { corsHeaders } from '../_shared/cors-headers.ts';
// Zod ライブラリをインポート (リクエストボディのバリデーション用)
import { z, ZodError } from "https://deno.land/x/zod@v3.22.4/index.ts";

// Gemini API キーとエンドポイント
const GEMINI_API_KEY: string | undefined = (globalThis as typeof globalThis & { Deno: typeof Deno }).Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// リクエストボディのスキーマ定義
const requestBodySchema = z.object({
  userInput: z.string(),
  context: z.object({
    vocabulary: z.string().optional(),
    meaning: z.string().optional(),
    pronunciation: z.string().optional(),
    part_of_speech: z.string().optional(),
    examples: z.array(z.object({ en: z.string(), ja: z.string() })).optional(),
    synonyms: z.array(z.string()).optional(),
    conjugations: z.record(z.string()).optional(),
    notes: z.string().optional(),
  }).optional(),
});
// 型定義
/**
 * get-dictionary-chat-responseのリクエストボディ型
 */
type RequestBody = z.infer<typeof requestBodySchema>;

Deno.serve(async (req: Request) => {
  // CORS プリフライトリクエスト (OPTIONS) の処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const requestJson = await req.json();
    const validatedBody = requestBodySchema.safeParse(requestJson);
    if (!validatedBody.success) {
      return new Response(JSON.stringify({ error: 'リクエストボディが無効です', details: validatedBody.error.issues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    const { userInput, context } = validatedBody.data;

    // Gemini用プロンプト組み立て
    let userMessageContent = `あなたは英語学習者向けのAIアシスタントです。ユーザーの質問に対して、分かりやすく、丁寧な言葉遣いで答えてください。\n\nユーザーの質問: "${userInput}"\n\n`;
    if (context) {
      userMessageContent += "以下の語彙情報に基づいて答えてください:\n";
      if (context.vocabulary) userMessageContent += `- Vocabulary: ${context.vocabulary}\n`;
      if (context.meaning) userMessageContent += `- Meaning: ${context.meaning}\n`;
      if (context.pronunciation) userMessageContent += `- Pronunciation: ${context.pronunciation}\n`;
      if (context.part_of_speech) userMessageContent += `- Part of Speech: ${context.part_of_speech}\n`;
      if (context.notes) userMessageContent += `- Notes: ${context.notes}\n`;
      if (context.examples && Array.isArray(context.examples) && context.examples.length > 0) {
        userMessageContent += "- Examples:\n";
        (context.examples as { en: string; ja: string }[]).forEach((ex: { en: string; ja: string }, index: number) => {
          userMessageContent += `  - Example ${index + 1}: \"${ex.en}\" (Japanese: \"${ex.ja}\")\n`;
        });
      }
      if (context.synonyms && Array.isArray(context.synonyms) && context.synonyms.length > 0) {
        userMessageContent += `- Synonyms: ${context.synonyms.join(", ")}\n`;
      }
      if (context.conjugations && typeof context.conjugations === 'object' && Object.keys(context.conjugations).length > 0) {
        userMessageContent += "- Conjugations:\n";
        (Object.entries(context.conjugations) as [string, string][]).forEach(([type, form]) => {
          userMessageContent += `  - ${type}: ${form}\n`;
        });
      }
    }

    // Gemini APIリクエストボディ
    const geminiRequestBody = {
      contents: [
        { role: "user", parts: [{ text: userMessageContent }] },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    };

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequestBody),
    }).catch((error: unknown) => {
      console.error("Fetch error calling Gemini API:", error);
      throw new Error('Fetch request to Gemini API failed');
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`Gemini API request failed with status ${geminiResponse.status}: ${errorBody}`);
      throw new Error(`Gemini API request failed (${geminiResponse.status})`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponseText: string | undefined = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!aiResponseText) {
      return new Response(
        JSON.stringify({ error: "AIが有効な応答を返しませんでした。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ text: aiResponseText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
    console.error('get-dictionary-chat-responseでエラーが発生しました:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 