# データベース テーブル構造一覧

---

## level_progress
- box_level_1: integer
- box_level_2: integer
- user_id: uuid
- id: uuid
- level_id: integer
- total_count: integer
- is_completed: boolean
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- box_level_6: integer
- box_level_5: integer
- box_level_4: integer
- box_level_3: integer

---

## levels
- updated_at: timestamp with time zone
- notes: text
- title: text
- level: text
- id: integer
- type: integer
- created_at: timestamp with time zone

---

## profiles
- id: uuid
- streak_count: integer
- last_study_date: timestamp with time zone
- avatar_url: text
- username: text
- daily_goal: integer
- updated_at: timestamp with time zone
- created_at: timestamp with time zone
- language_level: text

---

## study_history
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- id: uuid
- user_id: uuid
- vocabulary_id: integer
- study_status_id: uuid
- before_box_level: integer
- after_box_level: integer
- is_correct: boolean
- type: integer

---

## study_status
- created_at: timestamp with time zone
- study_date: timestamp with time zone
- vocabulary_id: integer
- user_id: uuid
- id: uuid
- type: integer
- is_completed: boolean
- delete_flg: boolean
- next_review_date: timestamp with time zone
- box_level: integer
- updated_at: timestamp with time zone

---

## study_status_jst
- study_date_jst: timestamp without time zone
- user_id: uuid
- vocabulary_id: integer
- updated_at_jst: timestamp without time zone
- box_level: integer
- next_review_date_jst: timestamp without time zone
- delete_flg: boolean
- is_completed: boolean
- created_at_jst: timestamp without time zone
- vocabulary: text
- id: uuid

---

## study_status_translation
- type: integer
- id: uuid
- user_id: uuid
- translation_training_id: integer
- box_level: integer
- next_review_date: timestamp with time zone
- study_date: timestamp with time zone
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- delete_flg: boolean
- is_completed: boolean

---

## translation_history
- id: uuid
- translated_language: text
- vocabulary_id: integer
- user_id: uuid
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- source_language: text
- translated_text: text
- source_text: text

---

## translation_training
- type: integer
- updated_at: timestamp with time zone
- created_at: timestamp with time zone
- level_id: integer
- id: integer
- japanese_text: text
- english_text: text
- notes: text

---

## vocabulary
- synonyms: ARRAY
- conjugations: jsonb
- id: integer
- vocabulary: text
- part_of_speech: text
- meanings: ARRAY
- level_id: integer
- example_sentences: jsonb
- source_language: text
- translated_language: text
- antonyms: ARRAY
- pronunciation: text
- notes: text
- updated_at: timestamp with time zone
- created_at: timestamp with time zone
- type: integer 