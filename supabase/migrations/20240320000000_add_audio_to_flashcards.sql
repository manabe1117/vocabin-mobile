-- 既存の関数を削除
DROP FUNCTION IF EXISTS get_flashcards_with_audio(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_flashcards_with_audio(
  p_user_id UUID,
  p_type INTEGER
)
RETURNS TABLE (
  id INTEGER,
  vocabulary_id INTEGER,
  vocabulary TEXT,
  part_of_speech TEXT,
  meanings TEXT[],
  pronunciation TEXT,
  examples JSONB,
  synonyms TEXT[],
  antonyms TEXT[],
  notes TEXT,
  box_level INTEGER,
  last_studied TIMESTAMP WITH TIME ZONE,
  audio_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.id AS vocabulary_id,
    v.vocabulary,
    v.part_of_speech,
    v.meanings,
    v.pronunciation,
    v.example_sentences AS examples,
    v.synonyms,
    v.antonyms,
    v.notes,
    COALESCE(ss.box_level, 0) AS box_level,
    ss.study_date AS last_studied,
    ac.url as audio_url
  FROM
    study_status ss
  INNER JOIN
    vocabulary v ON ss.vocabulary_id = v.id
  LEFT JOIN
    audio_cache ac ON v.vocabulary = ac.text AND ac.language = 'en'
  WHERE
    ss.user_id = p_user_id
    AND ss.delete_flg = FALSE
    AND ss.is_completed = FALSE
    AND ss.type = p_type
    AND (ss.next_review_date <= NOW() OR ss.next_review_date is null)
  ORDER BY
    ss.next_review_date ASC;
END;
$$; 