import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";

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

const requestBodySchema = z.object({
  sentenceIds: z.array(z.number()),
});
type RequestBody = z.infer<typeof requestBodySchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    const userId = user.id;

    let sentenceIds: number[] = [];
    if (req.method === 'POST') {
      const requestBody = await req.json();
      const validatedBody = requestBodySchema.safeParse(requestBody);
      if (!validatedBody.success) {
        throw new Error('Invalid request body');
      }
      sentenceIds = validatedBody.data.sentenceIds;
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      const idsParam = url.searchParams.get('sentenceIds');
      if (!idsParam) throw new Error('sentenceIds is required');
      sentenceIds = idsParam.split(',').map((id) => parseInt(id)).filter((id) => !isNaN(id));
    } else {
      throw new Error('Invalid request method');
    }
    if (!sentenceIds.length) {
      throw new Error('sentenceIds is empty');
    }
    // 一括取得
    const { data, error } = await supabase
      .from<StudyStatusSentence>('study_status_sentence')
      .select('sentence_id')
      .eq('user_id', userId)
      .in('sentence_id', sentenceIds)
      .eq('delete_flg', false);
    if (error) throw error;
    // 結果をマッピング
    const result: { [key: number]: boolean } = {};
    for (const id of sentenceIds) {
      result[id] = false;
    }
    if (data && Array.isArray(data)) {
      for (const row of data) {
        result[row.sentence_id] = true;
      }
    }
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('予期せぬエラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 