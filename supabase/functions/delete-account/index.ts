import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()

    if (!userId) {
      throw new Error('ユーザーIDが必要です')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // publicスキーマのユーザー関連データを削除
    const tablesToDelete = [
      'user_vocabulary',
      'study_history', 
      'study_status',
      'study_status_sentence',
      'study_status_translation',
      'chat_histories',
      'chat_sessions',
      'dictionary_search_history',
      'inquiries',
      'level_progress',
      'translation_history',
      'vocabulary_issue_reports'
    ]

    // 各テーブルからユーザーデータを削除
    for (const table of tablesToDelete) {
      const { error } = await supabaseClient
        .from(table)
        .delete()
        .eq('user_id', userId)

      if (error) {
        console.error(`${table}削除エラー:`, error)
        // エラーが発生しても処理を継続
      }
    }

    // profilesテーブルからユーザープロフィールを削除
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('プロフィール削除エラー:', profileError)
    }

    // authスキーマのユーザーアカウントを削除
    // これにより関連する認証データも自動的に削除される
    const { error: userError } = await supabaseClient.auth.admin.deleteUser(userId)

    if (userError) {
      throw new Error(`ユーザー削除エラー: ${userError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'アカウントデータが正常に削除されました。Googleアカウントとの連携も解除されました。' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('アカウント削除エラー:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
