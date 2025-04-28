import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 認証
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header is missing');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');
    const userId = user.id;

    // is_completed=trueの件数
    const { count: completedCount, error: completedError } = await supabase
      .from('study_status')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_completed', true)
      .eq('delete_flg', false);
    if (completedError) throw completedError;

    // is_completed=falseの件数
    const { count: learningCount, error: learningError } = await supabase
      .from('study_status')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_completed', false)
      .eq('delete_flg', false);
    if (learningError) throw learningError;

    return new Response(
      JSON.stringify({ completedCount, learningCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 