import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts"; 
import { add } from "https://esm.sh/date-fns@2.30.0";

// study_status_sentence用の型
interface StudyStatusSentence {
  id: string;
  user_id: string;
  sentence_id: number;
  created_at: string;
  box_level: number;
  next_review_date: string;
  delete_flg: boolean;
  updated_at: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// POST用: 例文保存/削除トグル
const requestBodySchema = z.object({
  sentenceId: z.number(),
});
type RequestBody = z.infer<typeof requestBodySchema>;

// PUT用: box_level等の更新
const putRequestBodySchema = z.object({
  sentenceId: z.number(),
  isCorrect: z.boolean(),
  studyDate: z.string().datetime(),
});
type PutRequestBody = z.infer<typeof putRequestBodySchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header is missing');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');
    const userId = user.id;

    if (req.method === 'POST') {
      const requestBody = await req.json();
      const validatedBody = requestBodySchema.safeParse(requestBody);
      if (!validatedBody.success) {
        console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
        throw new Error('Invalid request body');
      }
      const { sentenceId } = validatedBody.data;
      // 既存レコード検索
      const { data: existingRecord, error: fetchError } = await supabase
        .from<StudyStatusSentence>('study_status_sentence')
        .select('*')
        .eq('user_id', userId)
        .eq('sentence_id', sentenceId)
        .limit(1)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (existingRecord) {
        // 削除フラグをトグル
        const newDeleteFlg = !existingRecord.delete_flg;
        const { error: updateError } = await supabase
          .from<StudyStatusSentence>('study_status_sentence')
          .update({
            delete_flg: newDeleteFlg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRecord.id);
        if (updateError) throw updateError;
        return new Response(
          JSON.stringify({ isSaved: !newDeleteFlg }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } else {
        // 新規保存
        const boxLevel = 0;
        const nextReviewDate = new Date();
        const { error: insertError } = await supabase
          .from<StudyStatusSentence>('study_status_sentence')
          .insert({
            user_id: userId,
            sentence_id: sentenceId,
            box_level: boxLevel,
            next_review_date: nextReviewDate.toISOString(),
          });
        if (insertError) throw insertError;
        return new Response(
          JSON.stringify({ isSaved: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } else if (req.method === 'PUT') {
      const requestBody = await req.json();
      const validatedBody = putRequestBodySchema.safeParse(requestBody);
      if (!validatedBody.success) {
        console.error('リクエストボディのバリデーションエラー:', validatedBody.error.issues);
        throw new Error('Invalid request body');
      }
      const { sentenceId, isCorrect, studyDate } = validatedBody.data;
      // 既存レコード検索
      const { data: existingRecord, error: fetchError } = await supabase
        .from<StudyStatusSentence>('study_status_sentence')
        .select('*')
        .eq('user_id', userId)
        .eq('sentence_id', sentenceId)
        .limit(1)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const currentBoxLevel = existingRecord?.box_level || 0;
      let newBoxLevel = isCorrect
        ? Math.min(currentBoxLevel + 1, 6)
        : Math.max(currentBoxLevel - 1, 0);
      let newNextReviewDate = new Date();
      if (isCorrect) {
        if (currentBoxLevel >= 1) {
          const { data: lastStatus, error: fetchLastError } = await supabase
            .from<StudyStatusSentence>('study_status_sentence')
            .select('study_date')
            .eq('user_id', userId)
            .eq('sentence_id', sentenceId)
            .limit(1)
            .maybeSingle();
          if (fetchLastError) throw fetchLastError;
          if (lastStatus && lastStatus.study_date) {
            const lastStudiedDate = new Date(lastStatus.study_date);
            const now = new Date();
            const diffInHours = (now.getTime() - lastStudiedDate.getTime()) / (1000 * 60 * 60);
            if (diffInHours < 6) {
              newBoxLevel = currentBoxLevel;
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
            break;
        }
      }
      // upsert
      const { error: updateError } = await supabase
        .from<StudyStatusSentence>('study_status_sentence')
        .upsert(
          {
            user_id: userId,
            sentence_id: sentenceId,
            box_level: newBoxLevel,
            next_review_date: newNextReviewDate.toISOString(),
            study_date: studyDate,
            is_completed: newBoxLevel === 6,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, sentence_id" }
        );
      if (updateError) throw updateError;
      return new Response(
        JSON.stringify({ message: "Study sentence updated successfully", newBoxLevel }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
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