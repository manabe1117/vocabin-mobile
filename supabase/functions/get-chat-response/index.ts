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
      '# 応答形式の厳守: あなたの応答は、必ず、以下のJSONスキーマに厳密に従ったJSONオブジェクトの「文字列表現」でなければなりません。',
      '# このJSON文字列以外に、説明、マークダウンの囲み(```json ... ```など)、コメント、空行、その他の文字列を絶対に出力しないでください。',
      '# 全てのユーザー向けのテキストメッセージや説明は、必ず生成するJSONオブジェクト内の`replyText`フィールドに含めてください。',
      '',
      '```json',
      JSON.stringify(exampleJsonForPrompt, null, 2), // インデント付きでJSON例を挿入
      '```',
      '',
      '# フィールド説明:',
      '# - replyText: ユーザーへの回答や説明文です。ここに例文のテキストを直接入れないでください。ユーザーへのメッセージ、AIとしての見解、指示されたタスクに対する返答などはすべてこのフィールドに含めます。',
      '# - generatedExamples: 英語の例文オブジェクトの配列です。例文がない場合は、必ず空の配列 [] を返してください。',
      '',
      '# 重要な注意:',
      '# - あなたのタスクは、上記の指示とスキーマに従って、単一のJSON文字列を生成し、それ「だけ」を返すことです。',
      '# - JSON文字列を ```json ... ``` や他のマークダウンで囲まないでください。生のJSON文字列を直接返してください。',
      '# - 例文が1つも生成できない場合も、`replyText`と`generatedExamples: []` を持つJSON文字列を必ず返してください。',
      '',
      '# 具体例1: ユーザーが「こんにちは」の例文を求めた場合',
      '# 期待されるJSON文字列応答:',
      JSON.stringify(exampleUserRequest1, null, 2), // 具体例1を挿入
      '',
      '# 具体例2: ユーザーが「ありがとうの別の言い方は？」と質問し、例文がない場合',
      '# 期待されるJSON文字列応答:',
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
        maxOutputTokens: 2048,
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
    console.log("Gemini API raw response text (from parts[0].text):", rawAiTextFromGemini);

    // replyText と generatedExamples をこのスコープで宣言し、
    // 以下の解析ロジックでこれらの値を設定する。
    let replyText: string = "";
    let generatedExamples: any[] = []; 
    let jsonSuccessfullyProcessed = false;

    // Attempt 1: Is the entire string a JSON object?
    try {
      const parsed = JSON.parse(rawAiTextFromGemini);
      if (parsed.replyText !== undefined && Array.isArray(parsed.generatedExamples)) {
        replyText = parsed.replyText;
        generatedExamples = parsed.generatedExamples;
        jsonSuccessfullyProcessed = true;
        console.log("Attempt 1: Successfully parsed raw AI response directly as JSON object.");
      } else {
        console.log("Attempt 1: Parsed directly, but missing replyText or generatedExamples fields.");
      }
    } catch (e: any) {
      console.error("Attempt 1: Failed to parse raw AI response directly. Error: " + e.message, "Stack: " + e.stack);
    }

    // Attempt 2: Is there a ```json ... ``` block?
    if (!jsonSuccessfullyProcessed) {
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const match = rawAiTextFromGemini.match(codeBlockRegex);

      if (match && match[1]) {
        const jsonContent = match[1].trim();
        console.log("Attempt 2: Extracted JSON content from Markdown block for parsing:", jsonContent);
        try {
          const parsedJson = JSON.parse(jsonContent);
          if (parsedJson.replyText !== undefined && Array.isArray(parsedJson.generatedExamples)) {
            let extractedReplyText = parsedJson.replyText;
            generatedExamples = parsedJson.generatedExamples;

            const blockStartIndex = rawAiTextFromGemini.indexOf(match[0]);
            let prefix = "";
            if (blockStartIndex > 0) {
              prefix = rawAiTextFromGemini.substring(0, blockStartIndex).trim();
            } else if (blockStartIndex === -1) {
                console.warn("Attempt 2: Matched code block but could not find its start index.");
            }
            
            const pTrimmed = prefix.trim();
            const jTrimmed = (typeof extractedReplyText === 'string' ? extractedReplyText.trim() : '');

            if (jTrimmed.length === 0) {
                replyText = pTrimmed;
            } else if (pTrimmed.length === 0) {
                replyText = jTrimmed;
            } else if (pTrimmed.includes(jTrimmed)) {
                replyText = pTrimmed;
            } else if (jTrimmed.includes(pTrimmed)) {
                replyText = jTrimmed;
            } else {
                replyText = pTrimmed + "\n" + jTrimmed;
            }
            
            jsonSuccessfullyProcessed = true;
            console.log("Attempt 2: Successfully processed JSON from Markdown block.");
          } else {
             console.log("Attempt 2: Parsed JSON from Markdown, but missing/invalid replyText or generatedExamples fields.");
          }
        } catch (e: any) {
          console.error("Attempt 2: Failed to parse JSON content from Markdown block. Error: " + e.message, "JSON content was:" , jsonContent, "Stack:" + e.stack);
        }
      }
    }

    // Attempt 3: Is there a simple { ... } JSON substring (without Markdown)?
    if (!jsonSuccessfullyProcessed) {
        const firstBrace = rawAiTextFromGemini.indexOf('{');
        const lastBrace = rawAiTextFromGemini.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const potentialJsonSubstring = rawAiTextFromGemini.substring(firstBrace, lastBrace + 1);
            console.log("Attempt 3: Extracted potential JSON substring for parsing:", potentialJsonSubstring);
            try {
                const parsedSubstringJson = JSON.parse(potentialJsonSubstring);
                if (parsedSubstringJson.replyText !== undefined && Array.isArray(parsedSubstringJson.generatedExamples)) {
                    let extractedReplyText = parsedSubstringJson.replyText;
                    generatedExamples = parsedSubstringJson.generatedExamples;

                    let prefix = "";
                    if (firstBrace > 0) {
                        prefix = rawAiTextFromGemini.substring(0, firstBrace).trim();
                    }
                    
                    const pTrimmed = prefix.trim();
                    const jTrimmed = (typeof extractedReplyText === 'string' ? extractedReplyText.trim() : '');

                    if (jTrimmed.length === 0) {
                        replyText = pTrimmed;
                    } else if (pTrimmed.length === 0) {
                        replyText = jTrimmed;
                    } else if (pTrimmed.includes(jTrimmed)) {
                        replyText = pTrimmed;
                    } else if (jTrimmed.includes(pTrimmed)) {
                        replyText = jTrimmed;
                    } else {
                        replyText = pTrimmed + "\n" + jTrimmed;
                    }
                    jsonSuccessfullyProcessed = true;
                    console.log("Attempt 3: Successfully processed JSON from simple substring.");
                } else {
                     console.log("Attempt 3: Parsed simple JSON substring, but missing/invalid replyText or generatedExamples fields.");
                }
            } catch (e: any) {
                console.error("Attempt 3: Simple substring is not valid JSON or parsing failed. Error: " + e.message, "Substring was:", potentialJsonSubstring, "Stack:" + e.stack);
            }
        }
    }
    
    // Fallback: If no JSON structure could be reliably processed
    if (!jsonSuccessfullyProcessed) {
      console.log("Fallback: All JSON processing attempts failed.");
      
      const codeBlockMarker = "```json";
      const simpleBraceMarker = "{";

      let jsonStartIndex = -1;
      
      const codeBlockPos = rawAiTextFromGemini.indexOf(codeBlockMarker);
      const simpleBracePos = rawAiTextFromGemini.indexOf(simpleBraceMarker);

      if (codeBlockPos !== -1) {
        jsonStartIndex = codeBlockPos;
      }
      // If a simple brace appears before a code block marker, it might be the intended start
      if (simpleBracePos !== -1) {
        if (jsonStartIndex === -1 || simpleBracePos < jsonStartIndex) {
          jsonStartIndex = simpleBracePos;
        }
      }

      if (jsonStartIndex > 0) { 
        replyText = rawAiTextFromGemini.substring(0, jsonStartIndex).trim();
        console.log("Fallback: Extracted prefix as replyText:", replyText);
      } else if (jsonStartIndex === 0) {
        replyText = ""; // Starts with JSON marker, so no prefix text
        console.log("Fallback: Response starts with JSON marker, no prefix for replyText.");
      } else {
        // No clear JSON marker found, attempt to clean the whole string
        replyText = rawAiTextFromGemini
          .replace(/```(?:json)?\s*[\s\S]*$/, "") // Remove ```json and everything after to EOL/EOS
          .replace(/```[\s\S]*$/, "")             // Remove ``` and everything after to EOL/EOS
          .trim();
        console.log("Fallback: No JSON marker found or at start. Used cleaned raw text for replyText:", replyText);
      }
      generatedExamples = []; 
    }

    console.log("Final replyText for client (after all processing):", replyText);
    console.log("Final generatedExamples for client (count, after all processing):", generatedExamples.length);

    // --- 例文処理 & Sentence 保存 ---
    const examples: ExampleOutput[] = [];
    const aiMessageId = `${Date.now().toString()}-ai`;

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
      sessionId: currentSessionId,
      text: replyText,
      examples: examples, // このexamplesはDB保存後にsaved状態などが反映されたもの
      timestamp: new Date().toISOString(), // DB保存のタイムスタンプではなく、最終送信時のものを使う場合
    };
    
    // ★★★ 修正: クライアントに返す直前のオブジェクト全体をログに出力する場所を移動 ★★★
    console.log("FINAL RESPONSE OBJECT TO BE SENT TO CLIENT:", JSON.stringify(responseToClient, null, 2));
    
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