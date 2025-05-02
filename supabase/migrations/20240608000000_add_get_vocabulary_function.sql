-- vocabulary取得用ストアドプロシージャ（フィルター対応・品詞複数対応・ランダムシード対応・学習状態対応）
DROP FUNCTION IF EXISTS get_vocabulary(UUID, INTEGER, INTEGER, INTEGER, TEXT, TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_vocabulary(
  p_user_id UUID,
  p_page INTEGER,
  p_page_size INTEGER,
  p_sort_order TEXT,
  p_part_of_speech TEXT[] DEFAULT NULL,
  p_random_seed TEXT DEFAULT NULL,
  p_study_status TEXT DEFAULT NULL -- '学習中'|'学習済み'|NULL
)
RETURNS TABLE (
  id INTEGER,
  vocabulary TEXT,
  meanings TEXT[],
  part_of_speech TEXT,
  pronunciation TEXT,
  examples JSONB,
  synonyms TEXT[],
  notes TEXT,
  date_added TIMESTAMP WITH TIME ZONE,
  box_level INTEGER
) AS $$
BEGIN
  -- ランダムソート時のみシードをセット
  IF p_sort_order = 'random' AND p_random_seed IS NOT NULL THEN
    PERFORM setseed(hashtext(p_random_seed)::double precision / 2147483647);
  END IF;

  RETURN QUERY
  SELECT
    v.id,
    v.vocabulary,
    v.meanings,
    v.part_of_speech,
    v.pronunciation,
    v.example_sentences AS examples,
    v.synonyms,
    v.notes,
    v.created_at AS date_added,
    COALESCE(ss.box_level, 0) AS box_level
  FROM
    study_status ss
  INNER JOIN
    vocabulary v ON ss.vocabulary_id = v.id
  WHERE
    ss.user_id = p_user_id
    AND ss.delete_flg = FALSE
    AND (
      p_part_of_speech IS NULL OR array_length(p_part_of_speech, 1) = 0
      OR EXISTS (
        SELECT 1 FROM unnest(p_part_of_speech) AS pos
        WHERE ',' || v.part_of_speech || ',' LIKE '%,' || pos || ',%'
      )
    )
    AND (
      (p_study_status = '学習中' AND ss.is_completed = FALSE)
      OR (p_study_status = '学習済み' AND ss.is_completed = TRUE)
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