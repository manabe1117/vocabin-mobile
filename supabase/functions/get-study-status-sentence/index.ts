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

// GET用: sentenceIdのみ
const requestBodySchema = z.object({
  sentenceId: z.number(),
});
type RequestBody = z.infer<typeof requestBodySchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const sentenceId = parseInt(url.searchParams.get('sentenceId') || '');
      if (!sentenceId) {
        throw new Error('sentenceId is required');
      }
      const { data, error } = await supabase
        .from<StudyStatusSentence>('study_status_sentence')
        .select('id')
        .eq('user_id', userId)
        .eq('sentence_id', sentenceId)
        .eq('delete_flg', false)
        .limit(1);
      if (error) {
        throw error;
      }
      return new Response(
        JSON.stringify({ isSaved: data.length > 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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