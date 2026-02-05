-- Migration: Optimize RLS policies by replacing auth.uid() with (SELECT auth.uid())
-- The subquery form evaluates ONCE per query instead of once per row,
-- giving significant performance improvements on tables with many rows.
-- Applied via: mcp__supabase__apply_migration (name: "optimize_rls_auth_uid")
-- Date: 2026-02-04

SET search_path TO clarus, public, extensions;

-- =============================================================================
-- USERS TABLE
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- =============================================================================
-- CONTENT TABLE
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own content" ON content;
CREATE POLICY "Users can view their own content" ON content
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own content" ON content;
CREATE POLICY "Users can insert their own content" ON content
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own content" ON content;
CREATE POLICY "Users can update their own content" ON content
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own content" ON content;
CREATE POLICY "Users can delete their own content" ON content
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SUMMARIES TABLE
-- Note: "Anyone can view summaries" uses USING (true) — no auth.uid(), skip it
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert summaries for their content" ON summaries;
CREATE POLICY "Users can insert summaries for their content" ON summaries
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own summaries" ON summaries;
CREATE POLICY "Users can update their own summaries" ON summaries
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- CONTENT_RATINGS TABLE
-- Note: "Users can view all ratings" uses USING (true) — no auth.uid(), skip it
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert their own ratings" ON content_ratings;
CREATE POLICY "Users can insert their own ratings" ON content_ratings
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own ratings" ON content_ratings;
CREATE POLICY "Users can update their own ratings" ON content_ratings
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- CHAT_THREADS TABLE
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own threads" ON chat_threads;
CREATE POLICY "Users can view their own threads" ON chat_threads
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Drop all possible name variants from migration history
DROP POLICY IF EXISTS "Users can insert their own threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can create their own chat threads." ON chat_threads;
DROP POLICY IF EXISTS "Users can create their own chat threads" ON chat_threads;
CREATE POLICY "Users can insert their own threads" ON chat_threads
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can delete their own chat threads." ON chat_threads;
DROP POLICY IF EXISTS "Users can delete their own chat threads" ON chat_threads;
CREATE POLICY "Users can delete their own threads" ON chat_threads
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- CHAT_MESSAGES TABLE (uses subquery to check thread ownership)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in their own threads." ON chat_messages;
CREATE POLICY "Users can view messages in their threads" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages into their own threads." ON chat_messages;
CREATE POLICY "Users can insert messages in their threads" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete messages from their own threads." ON chat_messages;
DROP POLICY IF EXISTS "Users can delete messages in their threads" ON chat_messages;
CREATE POLICY "Users can delete messages in their threads" ON chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = (SELECT auth.uid())
    )
  );

-- =============================================================================
-- HIDDEN_CONTENT TABLE
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their hidden list" ON hidden_content;
CREATE POLICY "Users can view their hidden list" ON hidden_content
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can hide content" ON hidden_content;
CREATE POLICY "Users can hide content" ON hidden_content
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can unhide content" ON hidden_content;
CREATE POLICY "Users can unhide content" ON hidden_content
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- USAGE_TRACKING TABLE
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Note: "Service can manage usage" uses WITH CHECK (true) — no auth.uid(), skip it

-- =============================================================================
-- CLAIMS TABLE
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own claims" ON claims;
CREATE POLICY "Users can view own claims" ON claims
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Note: "Service can insert claims" uses WITH CHECK (true) — no auth.uid(), skip it
