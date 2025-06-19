// Supabase クライアントライブラリをインポート (npm モジュールを使用)
import { createClient } from "npm:@supabase/supabase-js";
// CORS ヘッダー設定をインポート
import { corsHeaders } from '../_shared/cors-headers.ts';
// Zod ライブラリをインポート (リクエストボディのバリデーション用)
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";

// 環境変数から Gemini API キーを取得
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Gemini API のエンドポイント URL
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Gemini API がスペル修正候補を返す場合のレスポンス型
interface SuggestionResponse {
  suggestions: string[]; // 複数のサジェスチョンを保持するように修正
}

// 単語データの構造を定義するインターフェース
interface VocabularyData {
  id?: number; // Supabase テーブルの ID (挿入後に付与)
  vocabulary: string; // 単語本体
  partOfSpeech: string; // 品詞 (日本語)
  pronunciation?: string; // 発音記号 (IPA) (オプショナル)
  meanings: string[]; // 意味 (日本語) の配列
  examples: { en: string; ja: string; }[]; // 例文 (英日ペア) の配列
  synonyms: string[]; // 類義語 (英語) の配列
  antonyms: string[]; // 対義語 (英語) の配列
  conjugations?: { [key: string]: string }; // 活用形 (オプショナル)
  notes?: string; // 補足情報 (日本語) (オプショナル)
}

// リクエストボディのスキーマ定義 (Zod を使用)
const requestBodySchema = z.object({
  vocabulary: z.string(), // "vocabulary" フィールドが文字列であることを要求
});
// リクエストボディの型 (スキーマから推論)
type RequestBody = z.infer<typeof requestBodySchema>;

// 環境変数から Supabase の URL とサービスロールキーを取得
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Supabase クライアントを初期化
// MEMO: 環境変数が設定されていない場合のエラーハンドリングは元のコードにはなかったため省略
const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

/**
 * 文字列が英語かどうかを判定する関数
 * @param text 判定する文字列
 * @returns 英語の場合はtrue、それ以外はfalse
 */
function isEnglish(text: string): boolean {
  // 英語の文字パターン（アルファベット、スペース、一般的な句読点と記号）
  // カンマ、ピリオド、感嘆符、疑問符、コロン、セミコロン、ハイフン、アポストロフィ、引用符、括弧などを許容
  // ハイフンをエスケープしてリテラル文字として扱う
  const englishPattern = /^[a-zA-Z0-9\s'\-.,!?:;"()[\]{}#$%&*+<=>@^_`|~]+$/;
  
  // 日本語の文字パターン（ひらがな、カタカナ、漢字）
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  
  // 日本語文字が含まれている場合はfalse
  if (japanesePattern.test(text)) {
    return false;
  }
  
  // 英語の文字パターンに一致する場合はtrue
  return englishPattern.test(text);
}

/**
 * 日本語の単語を英語に翻訳する関数
 * @param japaneseWord 日本語の単語
 * @returns 英語の単語の配列、翻訳に失敗した場合はnull
 */
async function translateToEnglish(japaneseWord: string): Promise<string[] | null> {
  try {
    const prompt = `
      Translate this Japanese word to English: "${japaneseWord}"
      If there are multiple possible translations, return them as a JSON array.
      If there is only one translation, return it as a single-item array.
      Return only the JSON array, nothing else.
      If the input is not Japanese, return ["${japaneseWord}"].
    `;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 1,
        topP: 0.1,
      },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Translation API request failed (${response.status})`);
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid translation API response structure');
    }

    let text = data.candidates[0].content.parts[0].text.trim();

    // Markdown形式のJSONコードブロックを除去
    const jsonStart = text.indexOf('```json');
    const jsonEnd = text.lastIndexOf('```');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.substring(jsonStart + 7, jsonEnd).trim();
    }
    
    const translations = JSON.parse(text);
    
    if (!Array.isArray(translations)) {
      throw new Error('Translation response is not an array');
    }

    return translations.filter((t: string) => typeof t === 'string' && t.trim() !== '');
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

// 検索履歴をUPSERTする関数
async function upsertDictionarySearchHistory(userId: string, vocabularyId: number, vocabulary: string) {
  // Supabaseクライアントのサービスロール権限で直接書き込み
  const { error } = await supabase
    .from('dictionary_search_history')
    .upsert([
      {
        user_id: userId,
        vocabulary_id: vocabularyId,
        vocabulary: vocabulary,
        searched_at: new Date().toISOString(),
      }
    ], { onConflict: ['user_id', 'vocabulary_id'] });
  if (error) {
    console.error('Error upserting dictionary_search_history:', error);
  }
}

/**
 * ユーザーごとのカスタム単語データを user_vocabulary テーブルから取得する関数
 * @param userId ユーザーID
 * @param vocabulary 検索する単語
 * @returns 存在すれば VocabularyData オブジェクト、存在しなければ null
 */
async function fetchUserVocabularyFromSupabase(userId: string, vocabulary: string): Promise<VocabularyData | null> {
  // user_vocabulary から直接取得
  const { data, error } = await supabase
    .from('user_vocabulary')
    .select('*')
    .eq('user_id', userId)
    .eq('vocabulary', vocabulary.trim())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user_vocabulary from Supabase:', error);
    return null;
  }
  if (!data) {
    return null;
  }

  // example_sentences のパース処理
  let parsedExamples: { en: string; ja: string; }[] = [];
  if (data.example_sentences) {
    if (typeof data.example_sentences === 'string') {
      try {
        parsedExamples = JSON.parse(data.example_sentences);
      } catch (e) {
        console.error('Error parsing example sentences:', e);
      }
    } else if (Array.isArray(data.example_sentences)) {
      parsedExamples = data.example_sentences;
    }
  }

  // conjugations のパース処理
  let parsedConjugations: { [key: string]: string } | undefined;
  if (data.conjugations) {
    if (typeof data.conjugations === 'string') {
      try {
        parsedConjugations = JSON.parse(data.conjugations);
      } catch (e) {
        console.error('Error parsing conjugations:', e);
      }
    } else if (typeof data.conjugations === 'object' && data.conjugations !== null) {
      parsedConjugations = data.conjugations as { [key: string]: string };
    }
  }

  return {
    id: data.vocabulary_id, // vocabulary_idをidとして返す
    vocabulary: data.vocabulary, // user_vocabularyのvocabulary列を使う
    partOfSpeech: data.part_of_speech || '',
    pronunciation: data.pronunciation,
    meanings: data.meanings || [],
    examples: parsedExamples,
    synonyms: data.synonyms || [],
    antonyms: data.antonyms || [],
    conjugations: parsedConjugations,
    notes: data.notes,
  } as VocabularyData;
}

// Deno の HTTP サーバーを起動
Deno.serve(async (req) => {
  // CORS プリフライトリクエスト (OPTIONS) の処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders, // 共通の CORS ヘッダー
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // 許可するメソッド
      },
    });
  }

  // POST リクエスト以外のメソッドを拒否
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405, // Method Not Allowed
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
    const userId: string = user.id;

    const requestBody = await req.json();
    const validatedBody = requestBodySchema.safeParse(requestBody);

    if (!validatedBody.success) {
      console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
      return new Response(JSON.stringify({ error: 'Invalid request body', details: validatedBody.error.issues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { vocabulary } = validatedBody.data;

    // 英語かどうかを判定
    const isEnglishInput = isEnglish(vocabulary);
    console.log(`Input "${vocabulary}" is ${isEnglishInput ? 'English' : 'Japanese'}`);

    // まずuser_vocabularyから取得
    let existingVocabulary = await fetchUserVocabularyFromSupabase(userId, vocabulary);
    if (!existingVocabulary) {
      // なければvocabularyテーブルから取得
      existingVocabulary = await fetchVocabularyFromSupabase(vocabulary);
    }

    if (isEnglishInput) {
      if (existingVocabulary) {
        // 履歴保存
        if (typeof existingVocabulary.id === "number") {
          await upsertDictionarySearchHistory(userId, existingVocabulary.id, existingVocabulary.vocabulary);
        }
        return new Response(JSON.stringify(existingVocabulary), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      // 存在しない場合はGeminiプロンプトへ
      const geminiApiResponse = await fetchGeminiApi(vocabulary);
      return await handleGeminiResponse(geminiApiResponse, vocabulary, userId);
    } else {
      // 英語以外の場合：まず翻訳
      const translations = await translateToEnglish(vocabulary);
      if (!translations) {
        return new Response(JSON.stringify({ error: 'Translation failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      if (translations.length === 1) {
        // 翻訳が1つの場合：user_vocabulary→vocabularyの順で検索
        let translatedVocabulary = await fetchUserVocabularyFromSupabase(userId, translations[0]);
        if (!translatedVocabulary) {
          translatedVocabulary = await fetchVocabularyFromSupabase(translations[0]);
        }
        if (translatedVocabulary) {
          // 履歴保存
          if (typeof translatedVocabulary.id === "number") {
            await upsertDictionarySearchHistory(userId, translatedVocabulary.id, translatedVocabulary.vocabulary);
          }
          return new Response(JSON.stringify(translatedVocabulary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        // 存在しない場合はGeminiプロンプトへ
        const geminiApiResponse = await fetchGeminiApi(translations[0]);
        return await handleGeminiResponse(geminiApiResponse, translations[0], userId);
      } else {
        // 翻訳が複数の場合：選択肢として返す
        return new Response(JSON.stringify({ translations }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
  } catch (error) {
    console.error('An error occurred:', error); // エラーログを出力

    // エラーの種類に応じて適切なレスポンスを返す (元のコードのロジックを踏襲)
    if (error instanceof Error) {
      if (error.message.includes('Gemini API request failed')) {
        return new Response(JSON.stringify({ error: "Failed to fetch data from Gemini API" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500, // Internal Server Error
        });
      } else if (error.message.includes('JSON parsing failed')) {
        return new Response(JSON.stringify({ error: "Failed to parse Gemini API response" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500, // Internal Server Error
        });
      } else if (error.message.includes('Failed to insert vocabulary to Supabase')) {
        return new Response(JSON.stringify({ error: "Failed to insert data into Supabase" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500, // Internal Server Error
        });
      } else {
        // その他の予期せぬエラー
        return new Response(JSON.stringify({ error: "An unexpected error occurred", details: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500, // Internal Server Error
        });
      }
    } else {
      // Error インスタンスではない予期せぬ例外
      return new Response(JSON.stringify({ error: "An unexpected non-error object was thrown" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500, // Internal Server Error
      });
    }
  }
});

/**
 * Supabase の 'vocabulary' テーブルから指定された単語のデータを取得する関数
 * @param vocabulary 検索する単語
 * @returns 存在すれば VocabularyData オブジェクト、存在しなければ null
 */
async function fetchVocabularyFromSupabase(vocabulary: string): Promise<VocabularyData | null> {
  console.log('Fetching vocabulary from Supabase:', vocabulary);

  const { data, error } = await supabase
    .from('vocabulary')
    .select('*')
    .eq('vocabulary', vocabulary.trim())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching vocabulary from Supabase:', error);
    return null;
  }

  if (!data) {
    console.log('Vocabulary not found in Supabase.');
    return null;
  }

  console.log('Supabase data found:', data);

  // example_sentences のパース処理
  let parsedExamples: { en: string; ja: string; }[] = [];
  if (data.example_sentences) {
    if (typeof data.example_sentences === 'string') {
      try {
        parsedExamples = JSON.parse(data.example_sentences);
      } catch (e) {
        console.error('Error parsing example sentences:', e);
      }
    } else if (Array.isArray(data.example_sentences)) {
      parsedExamples = data.example_sentences;
    }
  }

  // conjugations のパース処理
  let parsedConjugations: { [key: string]: string } | undefined;
  if (data.conjugations) {
    if (typeof data.conjugations === 'string') {
      try {
        parsedConjugations = JSON.parse(data.conjugations);
      } catch (e) {
        console.error('Error parsing conjugations:', e);
      }
    } else if (typeof data.conjugations === 'object' && data.conjugations !== null) {
      parsedConjugations = data.conjugations as { [key: string]: string };
    }
  }

  return {
    id: data.id,
    vocabulary: data.vocabulary,
    partOfSpeech: data.part_of_speech,
    pronunciation: data.pronunciation,
    meanings: data.meanings,
    examples: parsedExamples,
    synonyms: data.synonyms,
    antonyms: data.antonyms,
    conjugations: parsedConjugations,
    notes: data.notes,
  } as VocabularyData;
}

/**
 * Gemini API から取得した単語データを Supabase の 'vocabulary' テーブルに挿入する関数
 * @param vocabularyData 挿入する単語データ (Gemini API から取得したもの)
 * @param sourceLanguage ソース言語コード (例: 'en')
 * @param translatedLanguage 翻訳先言語コード (例: 'ja')
 * @returns 挿入されたレコードの ID
 * @throws Error 挿入に失敗した場合
 */
async function insertVocabularyToSupabase(
  vocabularyData: VocabularyData,
  sourceLanguage: string,
  translatedLanguage: string
): Promise<number> {
  console.log(`Inserting vocabulary "${vocabularyData.vocabulary}" into Supabase.`);

  // Supabase に挿入するデータオブジェクトを作成
  // pronunciation と notes も含める
  const { data, error } = await supabase
    .from('vocabulary')
    .insert([
      {
        vocabulary: vocabularyData.vocabulary.trim(), // 前後の空白を除去
        part_of_speech: vocabularyData.partOfSpeech,
        pronunciation: vocabularyData.pronunciation, // pronunciation を挿入
        meanings: vocabularyData.meanings,
        example_sentences: vocabularyData.examples, // JSONB/JSON型を想定
        synonyms: vocabularyData.synonyms,
        antonyms: vocabularyData.antonyms,
        conjugations: vocabularyData.conjugations, // JSONB/JSON型を想定
        notes: vocabularyData.notes,             // notes を挿入
        source_language: sourceLanguage,
        translated_language: translatedLanguage,
        type: 3, // type カラムに 3 を設定 (元のコード通り)
      },
    ])
    .select('id'); // 挿入された行の 'id' カラムの値を取得

  // 挿入時にエラーが発生した場合
  if (error) {
    console.error('Error inserting vocabulary to Supabase:', error);
    throw new Error('Failed to insert vocabulary to Supabase'); // エラーを投げる (元の仕様)
  }

  // 挿入成功時のログ
  console.log('Vocabulary inserted successfully:', data);

  // 挿入された ID を取得して返す (元のコードのロジック)
  if (data && data.length > 0 && data[0].id) {
    return data[0].id;
  } else {
    // ID が取得できなかった場合 (通常は起こらないはず)
    console.error('Failed to retrieve ID after insertion.');
    throw new Error('Failed to get id after insertion');
  }
}

/**
 * Gemini API にリクエストを送信し、単語情報またはスペル修正候補を取得する関数
 * @param vocabulary 情報を取得したい単語
 * @returns 単語情報 (VocabularyData) またはスペル修正候補 (SuggestionResponse)
 * @throws Error API リクエスト失敗、レスポンスのパース失敗など
 */
async function fetchGeminiApi(vocabulary: string): Promise<VocabularyData | SuggestionResponse> {
  console.log(`Fetching vocabulary data for "${vocabulary}" from Gemini API.`);

  // Gemini API に送信するプロンプト
  const prompt = `
    First, determine if "${vocabulary}" is:
    1. A noun, verb, adjective, adverb with punctuation or capitalization (e.g., "Approximately.")
    2. A common expression, greeting, question word, or complete sentence (e.g., "Hello!", "What?", "This is a test.")
    
    ONLY normalize category 1 (single vocabulary words with punctuation/capitalization) by:
    - Removing trailing punctuation marks (., !, ?, ;, etc.)
    - Converting to lowercase
    
    For example:
    - "Approximately." should be processed as "approximately"
    
    However, do NOT convert proper nouns (e.g., "American", "Tokyo") or acronyms/initialisms (e.g., "BS", "NASA") to lowercase. These should retain their original capitalization.

    Do NOT normalize any of these:
    - "Hello!" (keep as "Hello!")
    - "What?" (keep as "What?")
    - "This is a test." (keep as "This is a test.")
    - Any common greetings, expressions, questions, or sentences
    
    After determining if normalization is needed and performing it ONLY for category 1 words, check spelling.

    If the spelling is correct, return JSON dictionary data:
    {
      "vocabulary": "", // Use normalized form ONLY for category 1, keep original for everything else
      "part_of_speech": "",
      "pronunciation": "/IPA goes here/",
      "meanings": ["Meaning in Japanese"],
      "example_sentences": [{"english": "", "japanese": ""}],
      "synonyms": [],
      "antonyms": [],
      "conjugations": {},
      "notes": "Additional notes go here"
    }
    Use Japanese for "part_of_speech", "meanings", "notes". No romaji or translations in Japanese.
    Provide verb conjugations: "原形", "現在分詞", "過去形", "過去分詞", "三人称単数現在".
    Provide noun conjugations: "単数形", "複数形".
    Provide adjective conjugations: "比較級", "最上級", "副詞形".
    Provide adverb conjugations: "形容詞形".
    Use English for "synonyms", "antonyms". Use IPA for "pronunciation".
    Include irregular forms. Omit non-existent conjugations. If a specific conjugation form (e.g., "副詞形" for an adjective) does not exist, do not include the key for that conjugation in the output at all.

    REQUIREMENTS:
    1. Provide at least 2 natural example sentences. If the vocabulary has multiple distinct meanings or common usages, provide up to 3 example sentences, with one example for each distinct meaning or usage. Each example sentence must have both English and Japanese versions.
    2. Notes should provide language learning tips, common usage patterns, or important grammatical points specifically related to the input vocabulary. If the meaning changes significantly depending on the part of speech, please explain that as well. Focus on linguistic aspects, not general knowledge about the concept the word represents. Keep it under 100 characters and in Japanese. If there's nothing particularly noteworthy about the vocabulary itself for language learners, leave notes empty.

    If spelling is incorrect, return one of these two formats:
    1. If you're very confident about a single correction, return {"suggestion": "<corrected_spell>"}.
    2. If there are multiple possible corrections, return {"suggestions": ["<option1>", "<option2>", ...]} with up to 3 most likely corrections.

    Return only JSON. No extra fields.
  `;

  // Gemini API へのリクエストボディ
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: { // 生成設定 (元のコード通り)
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
    },
  };

  // リクエストボディをログ出力 (デバッグ用)
  console.log("Gemini API request body:", JSON.stringify(requestBody));

  // Gemini API に POST リクエストを送信
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }).catch(error => {
    // fetch 自体のエラー (ネットワークエラーなど)
    console.error("Fetch error calling Gemini API:", error);
    throw new Error('Fetch request failed'); // エラーを投げる
  });

  // API レスポンスが成功 (2xx) でない場合
  if (!response.ok) {
    const errorBody = await response.text(); // エラー内容を取得試行
    console.error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
    throw new Error(`Gemini API request failed (${response.status})`); // エラーを投げる
  }

  // レスポンスボディを JSON としてパース
  const data = await response.json();

  // レスポンスの構造を確認し、テキスト部分を取得
  // MEMO: この構造は Gemini API のバージョンによって変わる可能性あり
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
      console.error("Invalid Gemini API response structure:", JSON.stringify(data, null, 2));
      throw new Error("JSON parsing failed: Unexpected Gemini API response structure");
  }
  let text = data.candidates[0].content.parts[0].text;
  console.log("Gemini API raw response text:", text); // 生のテキストをログ出力

  // レスポンスに含まれる可能性がある Markdown の JSON コードブロックを除去 (元のコード通り)
  // 例: ```json ... ```
  const jsonStart = text.indexOf('```json');
  const jsonEnd = text.lastIndexOf('```');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    text = text.substring(jsonStart + 7, jsonEnd).trim(); // 前後の空白も除去
    console.log("Extracted JSON string from Markdown:", text);
  }

  try {
    // テキストを JSON オブジェクトとしてパース
    const jsonResponse: any = JSON.parse(text);

    // --- パース後の処理 ---

    // 1. 単語情報が含まれる場合 (スペル修正候補ではない)
    if (jsonResponse.vocabulary) {
      console.log(`Gemini API returned vocabulary data for "${jsonResponse.vocabulary}"`);

      // データの整形・クリーニング (元のコードのロジックを踏襲)
      let conjugations = jsonResponse.conjugations || {};
      let synonyms = jsonResponse.synonyms || [];
      let antonyms = jsonResponse.antonyms || [];

      // 活用形がネストされたオブジェクトの場合、フラットにする (元のコードの処理)
      if (typeof conjugations === 'object' && conjugations !== null) {
        if(Object.keys(conjugations).some(key => typeof conjugations[key] === 'object')){
            const flattenedConjugations = Object.values(conjugations).reduce((acc, curr) => {
                return { ...acc, ...curr };
            }, {});
            conjugations = flattenedConjugations;
          }
      }

      // 類義語: 文字列ならカンマ区切りで配列化、配列なら文字列のみフィルタリング (元のコードの処理)
      if (typeof synonyms === "string"){
          synonyms = synonyms.split(',').map(s => s.trim()).filter(s => s !== '');
      } else if (Array.isArray(synonyms)){
        synonyms = synonyms.filter((item: any) => typeof item === 'string' && item.trim() !== '');
      } else {
          synonyms = []; // それ以外は空配列
      }

      // 対義語: 同様に処理 (元のコードの処理)
      if(typeof antonyms === "string"){
        antonyms = antonyms.split(',').map(s => s.trim()).filter(s => s !== '');
      } else if(Array.isArray(antonyms)) {
          antonyms = antonyms.filter((item: any) => typeof item === 'string' && item.trim() !== '');
      } else {
          antonyms = []; // それ以外は空配列
      }

      // VocabularyData 型に整形
      // pronunciation と notes も jsonResponse から取得して設定
      const validatedResponse: VocabularyData = {
        vocabulary: typeof jsonResponse.vocabulary === 'string' ? jsonResponse.vocabulary : '',
        partOfSpeech: typeof jsonResponse.part_of_speech === 'string' ? jsonResponse.part_of_speech : '',
        pronunciation: typeof jsonResponse.pronunciation === 'string' ? jsonResponse.pronunciation : undefined, // string ならそのまま、そうでなければ undefined
        meanings: Array.isArray(jsonResponse.meanings) ? jsonResponse.meanings.filter((item: any) => typeof item === 'string') : [], // string の配列のみ
        examples: Array.isArray(jsonResponse.example_sentences)
          ? jsonResponse.example_sentences.map((ex: any) => ({ // en/ja が string のペアのみ
            en: typeof ex.english === 'string' ? ex.english : '',
            ja: typeof ex.japanese === 'string' ? ex.japanese : ''
          }))
          : [],
        synonyms: synonyms, // 整形済みの類義語
        antonyms: antonyms, // 整形済みの対義語
        conjugations: conjugations as { [key: string]: string } | undefined, // 整形済みの活用形 (型アサーション)
        notes: typeof jsonResponse.notes === 'string' ? jsonResponse.notes : undefined, // string ならそのまま、そうでなければ undefined
      };
      return validatedResponse; // 整形した単語データを返す

    // 2. 複数のスペル修正候補が含まれる場合
    } else if (jsonResponse.suggestions && Array.isArray(jsonResponse.suggestions)) {
      console.log(`Gemini API returned multiple spelling suggestions:`, jsonResponse.suggestions);
      const suggestionResponse: SuggestionResponse = {
        suggestions: jsonResponse.suggestions.filter((item: any) => typeof item === 'string').slice(0, 5) // 最大5つまで
      };
      return suggestionResponse; // 修正候補を返す

    // 3. 単一のスペル修正候補が含まれる場合 (後方互換性のため)
    } else if (jsonResponse.suggestion) {
      console.log(`Gemini API returned a single spelling suggestion: "${jsonResponse.suggestion}"`);
      // 単一のsuggestionでも配列形式に変換する
      const suggestionResponse: SuggestionResponse = {
        suggestions: [typeof jsonResponse.suggestion === 'string' ? jsonResponse.suggestion : '']
      };
      return suggestionResponse; // 修正候補を返す

    // 4. 予期しないレスポンス形式の場合
    } else {
      console.error('Invalid response format from Gemini (missing vocabulary or suggestions):', jsonResponse);
      throw new Error('Invalid response format'); // エラーを投げる
    }

  } catch (parseError) {
    // JSON パース自体に失敗した場合
    console.error("JSON parsing error:", parseError);
    console.error("Failed JSON Text:", text); // パースしようとしたテキストを出力
    const message = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(`JSON parsing failed: ${message}`); // エラーを投げる
  }
}

/**
 * Gemini APIのレスポンスを処理する関数
 * @param response Gemini APIからのレスポンス
 * @param vocabulary 元の単語
 * @returns 処理済みのレスポンス
 */
async function handleGeminiResponse(
  response: VocabularyData | SuggestionResponse,
  vocabulary: string,
  userId?: string
): Promise<Response> {
  if ('suggestions' in response) {
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  // Gemini APIから返された単語が元の入力と異なる場合（正規化された場合）
  if (response.vocabulary.toLowerCase() !== vocabulary.toLowerCase()) {
    console.log(`Normalized vocabulary: "${response.vocabulary}" differs from input: "${vocabulary}"`);
    
    // 正規化された単語でもう一度Supabaseを検索
    const existingVocabulary = await fetchVocabularyFromSupabase(response.vocabulary);
    if (existingVocabulary) {
      console.log(`Found existing data for normalized vocabulary: "${response.vocabulary}"`);
      // 履歴保存
      if (userId && typeof existingVocabulary.id === "number") {
        await upsertDictionarySearchHistory(userId, existingVocabulary.id, existingVocabulary.vocabulary);
      }
      return new Response(JSON.stringify(existingVocabulary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
  }

  const insertedId = await insertVocabularyToSupabase(response, 'en', 'ja');
  const formattedData: VocabularyData = {
    ...response,
    id: insertedId,
  };
  // 履歴保存
  if (userId && typeof insertedId === "number") {
    await upsertDictionarySearchHistory(userId, insertedId, response.vocabulary);
  }
  return new Response(JSON.stringify(formattedData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}