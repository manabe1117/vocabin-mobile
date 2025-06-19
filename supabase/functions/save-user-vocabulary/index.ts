import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/index.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

// リクエストボディのスキーマ定義
const saveUserVocabSchema = z.object({
  vocabularyId: z.number().int().positive(),
  vocabulary: z.string(),
  meanings: z.array(z.string()).optional(),
  pronunciation: z.string().optional(),
  part_of_speech: z.string().optional(),
  example_sentences: z.any().optional(), // jsonb
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
  notes: z.string().optional(),
  conjugations: z.record(z.string()).optional(),
});
type SaveUserVocabBody = z.infer<typeof saveUserVocabSchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError?.message || 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId = user.id;

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Invalid request method' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    const requestBody = await req.json();
    const validated = saveUserVocabSchema.safeParse(requestBody);
    if (!validated.success) {
      return new Response(JSON.stringify({ error: 'Invalid request body', details: validated.error.issues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    const {
      vocabularyId,
      vocabulary,
      meanings,
      pronunciation,
      part_of_speech,
      example_sentences,
      synonyms,
      antonyms,
      notes,
      conjugations,
    } = validated.data;

    // UPSERT（user_id, vocabulary_idで一意）
    const { error: upsertError } = await supabase
      .from('user_vocabulary')
      .upsert({
        user_id: userId,
        vocabulary_id: vocabularyId,
        vocabulary,
        meanings,
        pronunciation,
        part_of_speech,
        example_sentences,
        synonyms,
        antonyms,
        notes,
        conjugations,
        updated_at: new Date().toISOString(),
      }, { onConflict: ['user_id', 'vocabulary_id'] });

    if (upsertError) {
      return new Response(JSON.stringify({ error: 'Failed to save user vocabulary', details: upsertError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: 'User vocabulary saved successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 