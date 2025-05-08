import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/index.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const requestBodySchema = z.object({
  vocabularyId: z.number(),
  direction: z.enum(['known', 'unknown'])
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header is missing');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');
    const userId = user.id;
    const body = await req.json();
    const parsed = requestBodySchema.safeParse(body);
    if (!parsed.success) throw new Error('Invalid request body');
    const { vocabularyId, direction } = parsed.data;
    let box_level = direction === 'known' ? 6 : 0;
    let is_completed = direction === 'known';
    // 既存レコードを検索
    const { data: existing, error: fetchError } = await supabase
      .from('study_status')
      .select('*')
      .eq('user_id', userId)
      .eq('vocabulary_id', vocabularyId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    let result;
    if (existing) {
      // 更新
      const { data, error } = await supabase
        .from('study_status')
        .update({
          box_level,
          is_completed,
          updated_at: new Date().toISOString(),
          delete_flg: false,
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      result = data;
    } else {
      // 新規作成
      const { data, error } = await supabase
        .from('study_status')
        .insert({
          user_id: userId,
          vocabulary_id: vocabularyId,
          box_level,
          is_completed,
          next_review_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          delete_flg: false,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      result = data;
    }
    return new Response(JSON.stringify({ study_status: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 