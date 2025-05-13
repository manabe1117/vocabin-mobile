// Supabase クライアントライブラリをインポート
import { createClient } from "npm:@supabase/supabase-js";
// CORS ヘッダー設定をインポート
import { corsHeaders } from '../_shared/cors-headers.ts';
// Zod ライブラリをインポート (リクエストボディのバリデーション用)
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { v4 as uuidv4 } from "npm:uuid";

// 環境変数から Gemini API キーを取得
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Gemini API のエンドポイント URL (get-dictionary と同じモデル gemini-2.0-flash を使用)
// APIキーは fetch 時に付加するため、ここではベースURLのみ
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// リクエストボディのスキーマ定義 (Zod を使用)
const requestBodySchema = z.object({
  userInput: z.string(), // ユーザー入力
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(z.object({
      text: z.string(),
    })),
  })).optional(),
  sessionId: z.string().uuid().nullable().optional(), // ★ 追加: セッションID (null許容、任意)
});
// リクエストボディの型 (スキーマから推論)
type RequestBody = z.infer<typeof requestBodySchema>;

// データベースに保存する文の型
interface SentenceRow {
  id?: number; // DBが生成するID (戻り値で使用)
  japanese: string;
  english: string;
  note?: string;
  created_at?: string; // DBのデフォルト値を使用
}

// クライアントに返す例文の型
interface ExampleOutput {
  id: string;
  japanese: string;
  english: string;
  saved: boolean;
  note?: string;
  sentence_id?: number; // ★追加: sentenceテーブルのIDを追加
}

// ChatHistory テーブルの型 (保存用)
interface ChatHistoryInsert {
  user_id: string;
  session_id: string; // ★ 追加
  message_id: string;
  sender: 'user' | 'ai';
  text_content: string;
  timestamp?: string; // DBのデフォルトに任せる場合もある
  examples?: ExampleOutput[] | null;
  // richContent や contentBlocks も必要に応じて追加
}

// セッションを管理する関数 (取得または作成)
async function ensureChatSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | null | undefined,
  firstUserMessage: string
): Promise<string> {
  if (sessionId) {
    // セッションIDがある場合、存在確認と最終更新日時をアップデート
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ last_message_timestamp: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId) // 念のためユーザーIDも確認
      .select('session_id')
      .maybeSingle(); // 単一の結果、または null

    if (error) {
      console.error("Error updating chat session:", error);
      // エラーが発生しても処理を続行するが、新しいセッションを作る可能性も検討
      // ここでは既存の sessionId を返す試みをする
      return sessionId;
    }
    if (data) {
      console.log(`Chat session ${sessionId} updated.`);
      return sessionId; // 既存のセッションIDを返す
    }
    // 指定されたsessionIdが見つからない場合 (またはユーザーが異なる場合) は新規作成フローへ
    console.warn(`Session ID ${sessionId} not found for user ${userId}, creating a new session.`);
  }

  // セッションIDがない、または見つからなかった場合、新しいセッションを作成
  const newSessionId = uuidv4();
  // 簡単な要約を生成 (最初のユーザーメッセージの冒頭部分など)
  const summaryText = `ユーザー: ${firstUserMessage.substring(0, 50)}${firstUserMessage.length > 50 ? '...' : ''}`;
  const now = new Date().toISOString();

  const { data: newSession, error: insertError } = await supabase
    .from('chat_sessions')
    .insert({
      session_id: newSessionId,
      user_id: userId,
      summary: summaryText,
      created_at: now,
      last_message_timestamp: now,
    })
    .select('session_id')
    .single(); // 作成したセッションIDを取得

  if (insertError) {
    console.error("Error creating new chat session:", insertError);
    throw new Error("Failed to create a new chat session.");
  }

  console.log(`New chat session ${newSessionId} created.`);
  return newSession.session_id;
}

// ログメッセージをDBに保存する関数
async function logChatMessage(
  supabase: SupabaseClient,
  messageData: ChatHistoryInsert
) {
  try {
    const { error } = await supabase
      .from('chat_histories')
      .insert(messageData);
    if (error) {
      console.error(`Error saving message (sender: ${messageData.sender}):`, error);
    } else {
      console.log(`Message (sender: ${messageData.sender}) saved to chat_histories.`);
    }
  } catch (e) {
    console.error(`Exception saving message (sender: ${messageData.sender}):`, e);
  }
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
      throw new Error('認証ヘッダーがありません');
    }
    const token = authHeader.replace('Bearer ', '');

    const requestJson = await req.json();
    const validatedBody = requestBodySchema.safeParse(requestJson);

    if (!validatedBody.success) {
      console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
      return new Response(JSON.stringify({ error: 'リクエストボディが無効です', details: validatedBody.error.issues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Supabaseクライアントの作成
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // ★ サービスロールキーを使用（RLSをバイパス）
    );

    // JWT トークンを使用してユーザー認証
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('認証に失敗しました');
    }

    // 認証されたユーザーIDを取得
    const userId = user.id;

    // ユーザー入力とセッションIDの取得
    const { userInput, history, sessionId: requestedSessionId } = validatedBody.data;

    // --- セッション処理 ---
    const currentSessionId = await ensureChatSession(
      supabaseClient,
      userId,
      requestedSessionId,
      userInput
    );
    // --- セッション処理完了 ---

    // --- ユーザーメッセージ保存 ---
    const userMessageId = `${Date.now().toString()}-user`;
    const userMessageData: ChatHistoryInsert = {
      user_id: userId,
      session_id: currentSessionId, // ★ session_id を含める
      message_id: userMessageId,
      sender: 'user',
      text_content: userInput,
      timestamp: new Date().toISOString(),
    };
    await logChatMessage(supabaseClient, userMessageData); // 非同期でログ保存を実行 (完了を待たない)
    // --- ユーザーメッセージ保存完了 ---

    const exampleJsonForPrompt = { // プロンプトで見せるためのJSON構造の例
      replyText: "string (ここにはユーザーへの通常の返答や説明を記述します。例文そのものはここには含めません。)",
      generatedExamples: [
        {
          japanese: "string (例文の日本語訳)",
          english: "string (例文の英語原文)",
          note: "string (例文に関する補足情報。任意。なければ省略するか空文字)"
        }
      ]
    };

    const exampleUserRequest1 = { // プロンプトで見せる具体例1
      replyText: "「こんにちは」の一般的な英語表現の例文をいくつか紹介します。",
      generatedExamples: [
        { japanese: "こんにちは。", english: "Hello.", note: "最も一般的な挨拶です。" },
        { japanese: "やあ！", english: "Hi!", note: "よりカジュアルな挨拶です。" },
        { japanese: "おはようございます。", english: "Good morning.", note: "午前中に使います。" }
      ]
    };

    const exampleUserRequest2 = { // プロンプトで見せる具体例2
      replyText: "「ありがとう」の別の言い方としては、'Thanks a lot' や 'I appreciate it.' などがあります。特定の状況に合わせて使い分けましょう。",
      generatedExamples: []
    };

    const systemPromptParts = [
      '# 指示: あなたは英語学習支援APIとして機能します。',
      '# 応答形式の厳守: 全ての応答は、必ず、以下のJSONスキーマに厳密に従ったJSONオブジェクトとして出力してください。',
      '# このJSONオブジェクト以外の一切の追加テキスト、説明、マークダウン、コメントを含めないでください。',
      '',
      '```json',
      JSON.stringify(exampleJsonForPrompt, null, 2), // インデント付きでJSON例を挿入
      '```',
      '',
      '# フィールド説明:',
      '# - replyText: ユーザーへの回答や説明文です。ここに例文のテキストを直接入れないでください。',
      '# - generatedExamples: 英語の例文オブジェクトの配列です。',
      '#   - 例文がない場合は、必ず空の配列 [] を返してください。',
      '#   - 各例文オブジェクトは "japanese" と "english" フィールドを必須とします。',
      '',
      '# 重要な注意:',
      '# - ユーザーからの入力に対して、上記JSON形式を生成することがあなたの唯一のタスクです。',
      '# - JSONを```json ... ```で囲む必要はありません。生のJSONオブジェクトを直接返してください。',
      '',
      '# 具体例1: ユーザーが「こんにちは」の例文を求めた場合',
      '# 期待されるJSON応答:',
      JSON.stringify(exampleUserRequest1, null, 2), // 具体例1を挿入
      '',
      '# 具体例2: ユーザーが「ありがとうの別の言い方は？」と質問し、例文がない場合',
      '# 期待されるJSON応答:',
      JSON.stringify(exampleUserRequest2, null, 2), // 具体例2を挿入
    ];

    const systemPrompt = systemPromptParts.join('\n'); // 各行を改行で結合

    const contents = [];
    // 常にシステムプロンプトを会話の先頭（ただし、ユーザーロールとして）に配置
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });

    if (history && history.length > 0) {
      contents.push(...history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0].text.length < 200 ? h.parts[0].text : h.parts[0].text.substring(0,200) + "..." }]
      })));
    }
    // 現在のユーザーの質問
    contents.push({ role: "user", parts: [{ text: `ユーザーの質問は次のとおりです。\n${userInput}` }] });

    const geminiRequestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    };

    console.log("Gemini API request body:", JSON.stringify(geminiRequestBody, null, 2));

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequestBody),
    }).catch(error => {
      console.error("Fetch error calling Gemini API:", error);
      throw new Error('Fetch request to Gemini API failed');
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`Gemini API request failed with status ${geminiResponse.status}: ${errorBody}`);
      throw new Error(`Gemini API request failed (${geminiResponse.status})`);
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini API raw response data (full object):", JSON.stringify(geminiData, null, 2)); // Log the full object

    const rawAiTextFromGemini = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawAiTextFromGemini) {
      console.error("Invalid Gemini API response structure: candidates or parts missing", geminiData);
      throw new Error("Failed to parse Gemini API response: No text found in expected path");
    }
    console.log("Gemini API raw response text (from parts[0].text):", rawAiTextFromGemini); // Log the raw text itself

    let textToParse = rawAiTextFromGemini.trim();
    console.log("Initial textToParse (after trim):", JSON.stringify(textToParse));

    // Markdown形式のJSONコードブロックを除去する試み
    // パターン1: 完全な ```json ... ``` または ``` ... ```
    const fullBlockMatch = textToParse.match(/^\s*\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`\s*$/);

    if (fullBlockMatch && fullBlockMatch[1]) {
      textToParse = fullBlockMatch[1].trim();
      console.log("Extracted JSON string from full Markdown block:", textToParse);
    } else {
      console.log("Full Markdown block did NOT match. Attempting direct string manipulation for cleaning...");
      let cleanedText = textToParse;

      // 既知のプレフィックスを順番に試す
      const prefixesToRemove = ["```json", "```"];
      for (const prefix of prefixesToRemove) {
        if (cleanedText.startsWith(prefix)) {
          cleanedText = cleanedText.substring(prefix.length);
          console.log("Removed prefix \"" + prefix + "\". Current text:", JSON.stringify(cleanedText));
          cleanedText = cleanedText.trimStart(); // プレフィックス除去後に残る可能性のある先頭の空白や改行を除去
          console.log("After trimStart post prefix removal. Current text:", JSON.stringify(cleanedText));
          break; // 一致したらループを抜ける
        }
      }

      // 末尾の ``` を除去
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
        console.log("Removed suffix \"```\". Current text:", JSON.stringify(cleanedText));
        cleanedText = cleanedText.trimEnd(); // サフィックス除去後に残る可能性のある末尾の空白や改行を除去
        console.log("After trimEnd post suffix removal. Current text:", JSON.stringify(cleanedText));
      }

      textToParse = cleanedText.trim(); // 最終的にもう一度トリム
      console.log("Attempted to clean incomplete Markdown block, final result for textToParse:", textToParse);
    }

    let replyText = textToParse; // 初期値は（Markdown除去後の）テキスト全体
    let generatedExamples: any[] = []; // AIから生成された例文オブジェクト (japanese, english, note)
    
    try {
      const parsedResponse = JSON.parse(textToParse); // Markdown除去後のテキストをパース
      if (parsedResponse.replyText !== undefined && parsedResponse.generatedExamples !== undefined) {
        replyText = parsedResponse.replyText;
        generatedExamples = parsedResponse.generatedExamples;
        console.log("Successfully parsed AI response with", generatedExamples.length, "examples");
      } else {
        console.log("Parsed JSON, but not the expected structure (missing replyText or generatedExamples). Using textToParse as replyText.");
        // replyText は textToParse のままなので、ここでは明示的な代入は不要
      }
    } catch (e) {
      console.log("Failed to parse textToParse as JSON, treating as plain text. Error:", e);
      // replyText は textToParse のままなので、ここでは明示的な代入は不要
    }

    // --- 例文処理 & Sentence 保存 ---
    const examples: ExampleOutput[] = [];
    const aiMessageId = `${Date.now().toString()}-ai`; // AIメッセージのID (クライアント側で一意)

    if (generatedExamples && Array.isArray(generatedExamples) && generatedExamples.length > 0) {
      console.log(`Processing ${generatedExamples.length} examples for database insertion...`);
      
      // 例文をサーバー側で一時ID付与
      for (let i = 0; i < generatedExamples.length; i++) {
        const ex = generatedExamples[i];
        // japanese と english が両方存在する場合のみ処理
        if (ex.japanese && ex.english) {
          // 1. sentenceテーブルに保存して sentence_id を取得
          try {
            const sentenceData: SentenceRow = {
              japanese: ex.japanese,
              english: ex.english,
              note: ex.note || null,
            };

            const { data: insertedSentence, error: insertError } = await supabaseClient
              .from('sentence')
              .insert(sentenceData)
              .select();

            if (insertError) {
              console.error(`Error inserting sentence #${i}:`, insertError);
              // 保存に失敗してもクライアントには返す (sentence_id なし)
              examples.push({
                id: `${aiMessageId}-ex-${i}`,
                japanese: ex.japanese,
                english: ex.english,
                note: ex.note,
                saved: false,
              });
            } else if (insertedSentence && insertedSentence.length > 0) {
              console.log(`Successfully inserted sentence #${i} with ID ${insertedSentence[0].id}`);
              // 保存成功: sentence_id 付きで例文をクライアントに返す
              examples.push({
                id: `${aiMessageId}-ex-${i}`,
                japanese: ex.japanese,
                english: ex.english,
                note: ex.note,
                saved: false,
                sentence_id: insertedSentence[0].id, // 新しく挿入された文のID
              });
            }
          } catch (dbError) {
            console.error(`Exception in sentence insertion for example #${i}:`, dbError);
            // エラーが発生しても他の例文の処理を継続
            examples.push({
              id: `${aiMessageId}-ex-${i}`, 
              japanese: ex.japanese,
              english: ex.english,
              note: ex.note,
              saved: false,
            });
          }
        } else {
          console.warn(`Skipping example #${i} due to missing required fields:`, ex);
        }
      }
    }
    // --- 例文処理完了 ---

    // --- AIメッセージ保存 ---
    const aiMessageData: ChatHistoryInsert = {
      user_id: userId,
      session_id: currentSessionId, // ★ session_id を含める
      message_id: aiMessageId,
      sender: 'ai',
      text_content: replyText,
      timestamp: new Date().toISOString(),
      examples: examples.length > 0 ? examples : null,
    };
    await logChatMessage(supabaseClient, aiMessageData); // 非同期でログ保存を実行
    // --- AIメッセージ保存完了 ---

    // クライアントへの応答: AIテキスト, 例文リスト, メッセージID, タイムスタンプ, セッションID
    const responseToClient = {
      id: aiMessageId,
      sessionId: currentSessionId, // ★ session_id を返す
      text: replyText,
      examples: examples,
      timestamp: aiMessageData.timestamp, // 保存したメッセージのタイムスタンプ
    };
    
    return new Response(JSON.stringify(responseToClient), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('get-chat-responseでエラーが発生しました:', error);
    const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 