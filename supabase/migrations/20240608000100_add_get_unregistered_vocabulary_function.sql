-- study_statusに存在しないvocabularyを取得するストアドプロシージャ
-- ユーザーごと・typeごとに未登録の単語一覧を取得する
CREATE OR REPLACE FUNCTION get_unregistered_vocabulary(
  p_user_id UUID,
  p_type INTEGER,
  p_page INTEGER,
  p_page_size INTEGER,
  p_sort_order TEXT,
  p_part_of_speech TEXT[] DEFAULT NULL,
  p_random_seed TEXT DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  word TEXT,
  translation TEXT,
  part_of_speech TEXT,
  pronunciation TEXT,
  examples JSONB,
  synonyms TEXT[],
  notes TEXT,
  date_added TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- ランダムソート時のみシードをセット
  IF p_sort_order = 'random' AND p_random_seed IS NOT NULL THEN
    PERFORM setseed(hashtext(p_random_seed)::double precision / 2147483647);
  END IF;

  RETURN QUERY
  SELECT
    v.id,
    v.vocabulary AS word,
    COALESCE(v.meanings[1], '') AS translation,
    v.part_of_speech,
    v.pronunciation,
    v.example_sentences AS examples,
    v.synonyms,
    v.notes,
    v.created_at AS date_added
  FROM
    vocabulary v
  LEFT JOIN
    study_status ss
    ON ss.vocabulary_id = v.id
    AND ss.user_id = p_user_id
  WHERE
    v.type = p_type
    AND (ss.vocabulary_id IS NULL OR ss.delete_flg = true)
    AND (
      p_part_of_speech IS NULL OR array_length(p_part_of_speech, 1) = 0
      OR EXISTS (
        SELECT 1 FROM unnest(p_part_of_speech) AS pos
        WHERE ',' || v.part_of_speech || ',' LIKE '%,' || pos || ',%'
      )
    )
  ORDER BY
    CASE WHEN p_sort_order = 'alphabetical_asc' THEN v.vocabulary END ASC,
    CASE WHEN p_sort_order = 'alphabetical_asc' THEN v.id END ASC,
    CASE WHEN p_sort_order = 'alphabetical_desc' THEN v.vocabulary END DESC,
    CASE WHEN p_sort_order = 'alphabetical_desc' THEN v.id END DESC,
    CASE WHEN p_sort_order = 'random' THEN random() END,
    v.id ASC
  OFFSET (p_page - 1) * p_page_size
  LIMIT p_page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 