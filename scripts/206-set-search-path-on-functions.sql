-- Audit item #9: Set search_path on all Clarus database functions
-- This prevents search_path hijacking by explicitly binding each function
-- to the clarus and extensions schemas.
-- Applied: 2026-02-01

-- 1. increment_usage (overload 1: text params)
ALTER FUNCTION clarus.increment_usage(uuid, text, text)
  SET search_path = clarus, extensions;

-- 2. increment_usage (overload 2: varchar params)
ALTER FUNCTION clarus.increment_usage(uuid, character varying, character varying)
  SET search_path = clarus, extensions;

-- 3. search_content_suggestions
ALTER FUNCTION clarus.search_content_suggestions(uuid, text, integer)
  SET search_path = clarus, extensions;

-- 4. search_user_content
ALTER FUNCTION clarus.search_user_content(uuid, text, text, integer, integer)
  SET search_path = clarus, extensions;

-- 5. get_brain_content
ALTER FUNCTION clarus.get_brain_content(uuid, uuid)
  SET search_path = clarus, extensions;

-- 6. remove_tag_from_content
ALTER FUNCTION clarus.remove_tag_from_content(uuid, text)
  SET search_path = clarus, extensions;

-- 7. upsert_domain_stats
ALTER FUNCTION clarus.upsert_domain_stats(text, double precision, text)
  SET search_path = clarus, extensions;

-- 8. add_tag_to_content
ALTER FUNCTION clarus.add_tag_to_content(uuid, text)
  SET search_path = clarus, extensions;

-- 9. find_similar_claims
ALTER FUNCTION clarus.find_similar_claims(uuid, text, uuid, double precision, integer)
  SET search_path = clarus, extensions;

-- 10. handle_new_user (trigger function, no params)
ALTER FUNCTION clarus.handle_new_user()
  SET search_path = clarus, extensions;
