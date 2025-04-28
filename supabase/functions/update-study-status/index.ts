import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts"; 
import { add } from "https://esm.sh/date-fns@2.30.0";

interface StudyStatus {
  id: string;
  user_id: string;
  vocabulary_id: number;
  created_at: string;
  box_level: number;
  next_review_date: string;
  delete_flg: boolean;
  updated_at: string;
  type: number;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// リクエストボディの型定義 (GET, POST 用)
const requestBodySchema = z.object({
  vocabularyId: z.number(),
});
type RequestBody = z.infer<typeof requestBodySchema>;

// リクエストボディの型定義 (PUT 用)
const putRequestBodySchema = z.object({
  vocabularyId: z.number(),
  isCorrect: z.boolean(),
  studyDate: z.string().datetime(),
});
type PutRequestBody = z.infer<typeof putRequestBodySchema>;

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      },
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

    const userId = user.id;

    if (req.method === 'POST') {
      const requestBody = await req.json();
      const validatedBody = requestBodySchema.safeParse(requestBody);
      if (!validatedBody.success) {
        console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
        throw new Error('Invalid request body');
      }
      
      const { vocabularyId } = validatedBody.data;

      // 既に登録されているレコードを検索 (delete_flg の値に関わらず)
      const { data: existingRecord, error: fetchError } = await supabase
        .from<StudyStatus>('study_status')
        .select('*')
        .eq('user_id', userId)
        .eq('vocabulary_id', vocabularyId)
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }
      
      if (existingRecord) {
        // レコードが存在する場合、delete_flg を反転させる
        const newDeleteFlg = !existingRecord.delete_flg; // 現在の値と逆の値にする

        const { error: updateError } = await supabase
          .from<StudyStatus>('study_status')
          .update({
            delete_flg: newDeleteFlg, // 削除フラグを反転させる
            updated_at: new Date().toISOString(), // 更新日時を更新
          })
          .eq('id', existingRecord.id);

        if (updateError) {
          throw updateError
        }
        return new Response(
          JSON.stringify({ isSaved: !newDeleteFlg }), // delete_flg が false なら true, true なら false を返す
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else {
        const boxLevel = 0; // 初期値は 0
        const nextReviewDate = new Date(); // 初期値は現在日時
        
        // 存在しない場合、新規登録
        const { error: insertError } = await supabase
          .from<StudyStatus>('study_status')
          .insert({
            user_id: userId,
            vocabulary_id: vocabularyId,
            box_level: boxLevel,
            next_review_date: nextReviewDate.toISOString(),
          });
        
        if (insertError) {
          throw insertError
        }

        return new Response(
          JSON.stringify({ isSaved: true }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }
    // PUT リクエスト (学習履歴の更新)
    else if (req.method === 'PUT') {
      const requestBody = await req.json();
      const validatedBody = putRequestBodySchema.safeParse(requestBody);
      if (!validatedBody.success) {
        console.error(
          'リクエストボディのバリデーションエラー:',
          validatedBody.error.issues
        );
        throw new Error('Invalid request body');
      }

      const { vocabularyId, isCorrect, studyDate } = validatedBody.data;

      // 既に登録されているレコードを検索 (delete_flg の値に関わらず)
      const { data: existingRecord, error: fetchError } = await supabase
        .from<StudyStatus>('study_status')
        .select('*')
        .eq('user_id', userId)
        .eq('vocabulary_id', vocabularyId)
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      //  existingRecord から現在の box_level を取得
      const currentBoxLevel = existingRecord?.box_level || 0; // デフォルト値は0
      
      // Calculate new box_level based on currentBoxLevel and isCorrect
      // 変更: ✕ボタンの場合は box_level を -1 するが、下限は 0
      let newBoxLevel = isCorrect
        ? Math.min(currentBoxLevel + 1, 6)
        : Math.max(currentBoxLevel - 1, 0);

      let newNextReviewDate = new Date();
      
      if (isCorrect) {
        // 変更: 〇ボタンかつ、boxLevelが1以上の場合、最終学習日時から6時間以内なら boxLevel を増やさない
        if (currentBoxLevel >= 1) {
          const { data: lastStudyStatus, error: fetchLastError } = await supabase
            .from<StudyStatus>('study_status')
            .select('study_date')
            .eq('user_id', userId)
            .eq('vocabulary_id', vocabularyId)
            .limit(1)
            .maybeSingle();

          if (fetchLastError) {
            throw fetchLastError;
          }

          if (lastStudyStatus && lastStudyStatus.study_date) {
            const lastStudiedDate = new Date(lastStudyStatus.study_date);
            const now = new Date();
            const diffInHours = (now.getTime() - lastStudiedDate.getTime()) / (1000 * 60 * 60);

            if (diffInHours < 6 ) {
              newBoxLevel = currentBoxLevel; // boxLevel を変更しない
            } 
          }
        }

        switch (newBoxLevel) {
          case 0:
            newNextReviewDate = new Date();
            break;
          case 1:
            newNextReviewDate = add(new Date(), { days: 1 });
            break;
          case 2:
            newNextReviewDate = add(new Date(), { days: 3 });
            break;
          case 3:
            newNextReviewDate = add(new Date(), { days: 7 });
            break;
          case 4:
            newNextReviewDate = add(new Date(), { days: 14 });
            break;
          case 5:
            newNextReviewDate = add(new Date(), { days: 30 });
            break;
          case 6:
            // Do nothing, already completed
            break;
        }
      }

      // Update study_status using upsert
      const { error: updateError } = await supabase
        .from<StudyStatus>("study_status")
        .upsert(
          {
            user_id: userId,
            vocabulary_id: vocabularyId,
            box_level: newBoxLevel,
            next_review_date: newNextReviewDate.toISOString(),
            // 変更: study_date を更新
            study_date: studyDate,
            is_completed: newBoxLevel === 6,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, vocabulary_id" } // typeを除外
        );

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ message: "Study history updated successfully", newBoxLevel }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    throw new Error('Invalid request method');
  } catch (error) {
    console.error('予期せぬエラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});