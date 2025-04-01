// Supabase クライアントライブラリをインポート (npm モジュールを使用)
import { createClient } from "npm:@supabase/supabase-js";
// CORS ヘッダー設定をインポート
import { corsHeaders } from '../_shared/cors-headers.ts';
// Zod ライブラリをインポート (リクエストボディのバリデーション用)
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";

// 環境変数から Gemini API キーを取得
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Gemini API のエンドポイント URL
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

// Gemini API がスペル修正候補を返す場合のレスポンス型
interface SuggestionResponse {
  suggestion: string;
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
    // リクエストボディを JSON としてパースし、Zod でバリデーション
    const requestBody = await req.json();
    const validatedBody = requestBodySchema.safeParse(requestBody);

    // バリデーション失敗時のエラーハンドリング
    if (!validatedBody.success) {
      console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
      return new Response(JSON.stringify({ error: 'Invalid request body', details: validatedBody.error.issues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      });
    }

    // バリデーション済みのリクエストボディから単語を取得
    const { vocabulary } = validatedBody.data;

    // --- Step 1: Supabase で単語が存在するか確認 ---
    const existingVocabulary = await fetchVocabularyFromSupabase(vocabulary);

    // Supabase にデータが存在する場合、そのデータを返す
    if (existingVocabulary) {
      console.log(`Vocabulary "${vocabulary}" found in Supabase with ID: ${existingVocabulary.id}`);
      return new Response(JSON.stringify(existingVocabulary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // OK
      });
    }

    // --- Step 2: Supabase に存在しない場合、Gemini API で情報を取得 ---
    console.log(`Vocabulary "${vocabulary}" not found in Supabase. Fetching from Gemini API.`);
    const geminiApiResponse = await fetchGeminiApi(vocabulary);

    // Gemini API がスペル修正候補を返した場合
    if ('suggestion' in geminiApiResponse) {
      console.log(`Gemini API returned a spelling suggestion: "${geminiApiResponse.suggestion}" for "${vocabulary}"`);
      return new Response(JSON.stringify(geminiApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // OK (サジェストも成功レスポンスとして扱う)
      });
    }

    // --- Step 3: Gemini API から取得した単語情報を Supabase に挿入 ---
    const insertedId = await insertVocabularyToSupabase(
      geminiApiResponse, // Gemini から取得したデータ
      'en', // ソース言語 (固定)
      'ja'  // 翻訳先言語 (固定)
    );

    // --- Step 4: 挿入成功後、取得した ID を付与してクライアントに返す ---
    const formattedData: VocabularyData = {
      ...geminiApiResponse, // Gemini から取得した情報に
      id: insertedId,        // Supabase で発行された ID を追加
    };

    console.log(`Successfully inserted vocabulary "${vocabulary}" into Supabase with ID: ${insertedId}`);
    return new Response(JSON.stringify(formattedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // OK
    });

  // --- エラーハンドリング ---
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
    .from('vocabulary') // 'vocabulary' テーブルを指定
    .select('*')        // すべてのカラムを選択
    .eq('vocabulary', vocabulary.trim()) // 'vocabulary' カラムで完全一致検索 (前後の空白は除去)
    .limit(1)           // 結果を1件に制限
    .maybeSingle();     // 結果が0件または1件であることを期待 (複数件はエラー)

  // データ取得時にエラーが発生した場合
  if (error) {
    console.error('Error fetching vocabulary from Supabase:', error);
    return null; // エラーが発生した場合は null を返す (元の仕様)
  }

  // データが見つからなかった場合
  if (!data) {
    console.log('Vocabulary not found in Supabase.');
    return null;
  }

  // データが見つかった場合のログ
  console.log('Supabase data found:', data);

  // example_sentences (JSON文字列または配列) をパース
  let parsedExamples: { en: string; ja: string; }[] = [];
  if (data.example_sentences) {
    if (typeof data.example_sentences === 'string') {
      try {
        parsedExamples = JSON.parse(data.example_sentences);
      } catch (e) {
        console.error('Error parsing example sentences:', e);
        // パース失敗時は空配列のまま (元の仕様)
      }
    } else if (Array.isArray(data.example_sentences)) {
      // 既に配列の場合はそのまま使用
      parsedExamples = data.example_sentences;
    }
    // 文字列でも配列でもない場合は空配列のまま
  }

  // conjugations (JSON文字列またはオブジェクト) をパース
  let parsedConjugations: { [key: string]: string } | undefined;
  if (data.conjugations) {
    if (typeof data.conjugations === 'string') {
      try {
        parsedConjugations = JSON.parse(data.conjugations);
      } catch (e) {
        console.error('Error parsing conjugations:', e);
        // パース失敗時は undefined のまま (元の仕様)
      }
    } else if (typeof data.conjugations === 'object' && data.conjugations !== null) {
      // 既にオブジェクトの場合はそのまま使用 (null は除外)
      parsedConjugations = data.conjugations as { [key: string]: string }; // 型アサーションでオブジェクトであることを示す
    }
    // 文字列でもオブジェクトでもない場合は undefined のまま
  }

  // Supabase から取得したデータを VocabularyData 型に整形して返す
  // pronunciation と notes カラムの値も取得して含める
  return {
    id: data.id,
    vocabulary: data.vocabulary,
    partOfSpeech: data.part_of_speech,
    pronunciation: data.pronunciation, // DB から取得した pronunciation をそのまま設定
    meanings: data.meanings, // DB から取得した meanings をそのまま設定 (型チェックは元のコード通り省略)
    examples: parsedExamples,
    synonyms: data.synonyms, // DB から取得した synonyms をそのまま設定 (型チェックは元のコード通り省略)
    antonyms: data.antonyms, // DB から取得した antonyms をそのまま設定 (型チェックは元のコード通り省略)
    conjugations: parsedConjugations,
    notes: data.notes,         // DB から取得した notes をそのまま設定
  } as VocabularyData; // 型アサーション (元のコード通り)
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
  // pronunciation と notes の取得も依頼するよう修正
  const prompt = `
    Check spelling of "${vocabulary}".

    If the spelling of "${vocabulary}" is correct, return JSON dictionary data:
    {
      "vocabulary": "",
      "part_of_speech": "",
      "pronunciation": "/IPA goes here/",
      "meanings": ["Meaning of ${vocabulary} in Japanese"],
      "example_sentences": [{"english": "", "japanese": ""}],
      "synonyms": [],
      "antonyms": [],
      "conjugations": {},
      "notes": "Additional notes go here"
    }
    Use Japanese for "part_of_speech", "meanings", "notes". Do *not* include any parenthetical translations or romaji in the Japanese.
    Provide verb conjugations: "原形", "現在分詞", "過去形", "過去分詞", "三人称単数現在".
    Provide noun conjugations: "単数形", "複数形".
    Provide adjective conjugations: "比較級", "最上級".
    Use English for "synonyms", "antonyms". Use IPA for "pronunciation".
    Include irregular forms. Omit non-existent conjugations. Omit "pronunciation" or "notes" if not applicable or not available.

    If the spelling of "${vocabulary}" is incorrect, return {"suggestion": "<corrected_spell>"}. Where <corrected_spell> is the most likely corrected spelling for "${vocabulary}".

    Strictly JSON. When no suggestion, generate meanings. Do not include any extra fields like "id". Only include the requested fields.
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

    // 2. スペル修正候補が含まれる場合
    } else if (jsonResponse.suggestion) {
      console.log(`Gemini API returned a spelling suggestion: "${jsonResponse.suggestion}"`);
      const suggestionResponse: SuggestionResponse = {
        suggestion: typeof jsonResponse.suggestion === 'string' ? jsonResponse.suggestion : '' // string でなければ空文字
      };
      return suggestionResponse; // 修正候補を返す

    // 3. 予期しないレスポンス形式の場合
    } else {
      console.error('Invalid response format from Gemini (missing vocabulary or suggestion):', jsonResponse);
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