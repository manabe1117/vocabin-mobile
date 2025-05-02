import { corsHeaders } from '../_shared/cors-headers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

Deno.serve(async (req) => {
  // CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // JWT認証
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

    // bodyからパラメータ取得
    const body = await req.json();
    const page = parseInt(body.page || '1');
    const pageSize = parseInt(body.pageSize || '30');
    const sortOrder = body.sortOrder || 'alphabetical_asc';
    const filters = body.filters || {};
    const partOfSpeech = filters.partOfSpeech || null;
    const studyStatus = filters.studyStatus || null;
    const randomSeed = body.randomSeed || null;
    const unregistered = body.unregistered === true;

    // 未登録単語のみ取得する場合はget_unregistered_vocabularyを呼び出す
    let data, error;
    if (unregistered) {
      ({ data, error } = await supabase.rpc('get_unregistered_vocabulary', {
        p_user_id: userId,
        p_type: 2,
        p_page: page,
        p_page_size: pageSize,
        p_sort_order: sortOrder,
        p_part_of_speech: partOfSpeech,
        p_random_seed: randomSeed
      }));
    } else {
      // 登録済み単語取得
      ({ data, error } = await supabase.rpc('get_vocabulary', {
        p_user_id: userId,
        p_page: page,
        p_page_size: pageSize,
        p_sort_order: sortOrder,
        p_part_of_speech: partOfSpeech,
        p_random_seed: randomSeed,
        p_study_status: studyStatus
      }));
    }
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 