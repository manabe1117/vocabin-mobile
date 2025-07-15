import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors-headers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // プロフィール情報を取得（管理者フラグとユーザー名を含む）
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, is_admin')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Failed to fetch user profile:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    return new Response(
      JSON.stringify({ 
        isAdmin: profile?.is_admin === true,
        profile: {
          id: profile?.id,
          username: profile?.username,
          is_admin: profile?.is_admin
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in is-admin function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        isAdmin: false,
        profile: null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}); 