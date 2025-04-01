import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

interface SuggestionResponse {
  suggestion: string;
}

// VocabularyData インターフェースに pronunciation と notes を追加
interface VocabularyData {
  id?: number;
  vocabulary: string;
  partOfSpeech?: string; // Optional
  pronunciation?: string; // Optional, 追加
  meanings?: string[]; // Optional
  conjugations?: { [key: string]: string }; // Optional
  examples?: { en: string; ja: string; }[]; // Optional
  synonyms?: string[]; // Optional
  antonyms?: string[]; // Optional
  notes?: string; // Optional, 追加
}

const requestBodySchema = z.object({
  vocabulary: z.string(),
});
type RequestBody = z.infer<typeof requestBodySchema>;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceRoleKey || !GEMINI_API_KEY) {
    console.error("Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY");
    Deno.exit(1); // 環境変数がない場合は終了
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // 必要なヘッダーを追加
      },
    });
  }

  // POST リクエストのみ許可
  if (req.method !== 'POST') {
    console.warn(`Method Not Allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // リクエストボディのバリデーション
    let requestBody;
    try {
        requestBody = await req.json();
    } catch (jsonError) {
        console.error('リクエストボディのJSONパースエラー:', jsonError);
        return new Response(JSON.stringify({ error: 'Invalid JSON format' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    const validatedBody = requestBodySchema.safeParse(requestBody);
    if (!validatedBody.success) {
      console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
      return new Response(JSON.stringify({ error: 'Invalid request body', details: validatedBody.error.issues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { vocabulary } = validatedBody.data;
    console.log(`Processing vocabulary: ${vocabulary}`);

    // 1. vocabulary テーブルに登録されているか確認
    const existingVocabulary = await fetchVocabularyFromSupabase(vocabulary);
    if (existingVocabulary) {
      console.log(`Vocabulary "${vocabulary}" found in Supabase.`);
      return new Response(JSON.stringify(existingVocabulary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Vocabulary "${vocabulary}" not found in Supabase. Fetching from Gemini API.`);
    // 2. 登録されていなければ Gemini API から取得
    const geminiApiResponse = await fetchGeminiApi(vocabulary);

    // サジェストが返されたかどうかをチェック
    if ('suggestion' in geminiApiResponse) {
      console.log(`Suggestion received from Gemini: ${geminiApiResponse.suggestion}`);
      return new Response(JSON.stringify(geminiApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // サジェストの場合も 200 OK とする
      });
    }

    // 3. 取得したデータを vocabulary テーブルに挿入
    console.log(`Inserting vocabulary data from Gemini into Supabase.`);
    const insertedId = await insertVocabularyToSupabase(
      geminiApiResponse,
      'en', // source_language
      'ja'  // translated_language
    );
    console.log(`Successfully inserted vocabulary with ID: ${insertedId}`);

    // 4. 挿入したデータに id を追加して返す
    const formattedData: VocabularyData = {
      ...geminiApiResponse,
      id: insertedId,
    };

    return new Response(JSON.stringify(formattedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201, // 新規作成なので 201 Created
    });

  } catch (error) {
    console.error('エラー:', error);
    let status = 500;
    let message = "An unexpected error occurred";

    if (error instanceof Error) {
        if (error.message.includes('Gemini API request failed')) {
          message = "Failed to fetch data from Gemini API";
          status = 502; // Bad Gateway
        } else if (error.message.includes('JSON parsing failed')) {
          message = "Failed to parse Gemini API response";
          status = 500;
        } else if (error.message.includes('Failed to insert vocabulary to Supabase')) {
          message = "Failed to insert data into Supabase";
          status = 500;
        } else if (error.message.includes('Fetch request failed')) {
          message = "Network error while contacting Gemini API";
          status = 504; // Gateway Timeout
        } else if (error.message.includes('Invalid JSON format')) {
            message = 'Invalid JSON format in request body';
            status = 400;
        } else if (error.message.includes('Invalid request body')) {
            message = 'Invalid request body';
            status = 400;
        }
    }

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});

async function fetchVocabularyFromSupabase(vocabulary: string): Promise<VocabularyData | null> {
  console.log('Fetching vocabulary from Supabase:', vocabulary);

  const { data, error } = await supabase
    .from('vocabulary')
    // select に pronunciation と notes を追加
    .select('id, vocabulary, part_of_speech, pronunciation, meanings, example_sentences, synonyms, antonyms, conjugations, notes')
    .eq('vocabulary', vocabulary.trim().toLowerCase()) // 検索時は小文字に統一するなど考慮
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching vocabulary from Supabase:', error);
    // エラーの詳細をログに残すが、クライアントには一般的なエラーとして返すか、nullを返す
    return null; // or throw new Error('Supabase fetch failed');
  }

  if (!data) {
    console.log('Vocabulary not found in Supabase.');
    return null;
  }

  console.log('Supabase data retrieved:', data.id);

  // JSONB/配列型のパース (より安全に)
  const parseJsonOrArray = <T>(field: any, fieldName: string): T | undefined => {
      if (!field) return undefined;
      if (typeof field === 'object') return field as T; // すでにオブジェクト/配列の場合
      if (typeof field === 'string') {
          try {
              return JSON.parse(field) as T;
          } catch (e) {
              console.error(`Error parsing ${fieldName} from string:`, e, `Value: ${field}`);
              return undefined; // パース失敗時は undefined
          }
      }
      console.warn(`Unexpected type for ${fieldName}: ${typeof field}`);
      return undefined;
  };

  const parsedExamples = parseJsonOrArray<{ en: string; ja: string; }[]>(data.example_sentences, 'example_sentences');
  const parsedConjugations = parseJsonOrArray<{ [key: string]: string }>(data.conjugations, 'conjugations');
  const parsedMeanings = Array.isArray(data.meanings) ? data.meanings : undefined;
  const parsedSynonyms = Array.isArray(data.synonyms) ? data.synonyms : undefined;
  const parsedAntonyms = Array.isArray(data.antonyms) ? data.antonyms : undefined;

  // 戻り値に pronunciation と notes を追加
  return {
    id: data.id,
    vocabulary: data.vocabulary,
    partOfSpeech: data.part_of_speech ?? undefined, // NULLをundefinedに
    pronunciation: data.pronunciation ?? undefined, // NULLをundefinedに
    meanings: parsedMeanings,
    examples: parsedExamples,
    synonyms: parsedSynonyms,
    antonyms: parsedAntonyms,
    conjugations: parsedConjugations,
    notes: data.notes ?? undefined, // NULLをundefinedに
  };
}

async function insertVocabularyToSupabase(
  vocabularyData: VocabularyData,
  sourceLanguage: string,
  translatedLanguage: string
): Promise<number> {

  // Supabaseに送るデータを作成
  const dataToInsert = {
    vocabulary: vocabularyData.vocabulary.trim(),
    part_of_speech: vocabularyData.partOfSpeech,
    // pronunciation と notes を追加
    pronunciation: vocabularyData.pronunciation,
    notes: vocabularyData.notes,
    meanings: vocabularyData.meanings,
    // examples は JSONB なのでそのまま渡す
    example_sentences: vocabularyData.examples,
    synonyms: vocabularyData.synonyms,
    antonyms: vocabularyData.antonyms,
    // conjugations は JSONB なのでそのまま渡す
    conjugations: vocabularyData.conjugations,
    source_language: sourceLanguage,
    translated_language: translatedLanguage,
    // type は固定値 (必要に応じて変更)
    type: 3,
    // level_id は現状未設定 (必要なら追加)
    // level_id: vocabularyData.levelId,
  };

  const { data, error } = await supabase
    .from('vocabulary')
    .insert(dataToInsert)
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting vocabulary to Supabase:', error);
    throw new Error('Failed to insert vocabulary to Supabase');
  }

  if (!data) {
    throw new Error('No data returned after insert');
  }

  return data.id;
}

async function fetchGeminiApi(vocabulary: string): Promise<VocabularyData | SuggestionResponse> {
  const prompt = `以下の単語について、英語の辞書データを提供してください。JSON形式で返してください。

単語: ${vocabulary}

以下の形式で返してください：
{
  "vocabulary": "単語",
  "partOfSpeech": "品詞",
  "pronunciation": "発音",
  "meanings": ["意味1", "意味2", ...],
  "conjugations": {
    "過去形": "過去形",
    "過去分詞": "過去分詞",
    "現在分詞": "現在分詞",
    "三人称単数現在": "三人称単数現在"
  },
  "examples": [
    {
      "en": "英語の例文",
      "ja": "日本語訳"
    }
  ],
  "synonyms": ["類義語1", "類義語2", ...],
  "antonyms": ["対義語1", "対義語2", ...],
  "notes": "補足説明"
}

もし単語が見つからない場合や、スペルミスの可能性がある場合は、以下の形式で返してください：
{
  "suggestion": "推奨される単語"
}`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text;

    try {
      const parsedData = JSON.parse(generatedText);
      
      // サジェストが返された場合
      if ('suggestion' in parsedData) {
        return parsedData as SuggestionResponse;
      }

      // 通常の辞書データが返された場合
      return parsedData as VocabularyData;
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      throw new Error('JSON parsing failed');
    }
  } catch (error) {
    console.error('Fetch request failed:', error);
    throw error;
  }
} 