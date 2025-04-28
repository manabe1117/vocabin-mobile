-- vocabulary取得用ストアドプロシージャ
DROP FUNCTION IF EXISTS get_vocabulary(UUID, INTEGER, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION get_vocabulary(
  p_user_id UUID,
  p_type INTEGER,
  p_page INTEGER,
  p_page_size INTEGER,
  p_sort_order TEXT
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
  date_added TIMESTAMP WITH TIME ZONE,
  box_level INTEGER
) AS $$
BEGIN
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
    v.created_at AS date_added,
    COALESCE(ss.box_level, 0) AS box_level
  FROM
    study_status ss
  INNER JOIN
    vocabulary v ON ss.vocabulary_id = v.id
  WHERE
    ss.user_id = p_user_id
    AND ss.delete_flg = FALSE
    AND ss.type = p_type
  ORDER BY
    CASE WHEN p_sort_order = 'alphabetical_asc' THEN v.vocabulary END ASC,
    CASE WHEN p_sort_order = 'alphabetical_desc' THEN v.vocabulary END DESC
  OFFSET (p_page - 1) * p_page_size
  LIMIT p_page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 