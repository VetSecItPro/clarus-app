-- Migration: 212-create-collections
-- Description: Create collections and collection_items tables for organizing library content
-- Date: 2026-02-05

-- ===========================================
-- 1. Create clarus.collections table
-- ===========================================
CREATE TABLE IF NOT EXISTS clarus.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,           -- hex color for UI (e.g., '#1d9bf0')
    icon TEXT,            -- emoji or lucide icon name
    is_default BOOLEAN DEFAULT false,
    item_count INTEGER DEFAULT 0,  -- denormalized for performance
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

-- ===========================================
-- 2. Create clarus.collection_items table
-- ===========================================
CREATE TABLE IF NOT EXISTS clarus.collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES clarus.collections(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES clarus.content(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT now(),
    sort_order INTEGER DEFAULT 0,
    UNIQUE(collection_id, content_id)
);

-- ===========================================
-- 3. Indexes for foreign keys and common queries
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON clarus.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON clarus.collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_content_id ON clarus.collection_items(content_id);
CREATE INDEX IF NOT EXISTS idx_collections_user_id_name ON clarus.collections(user_id, name);

-- ===========================================
-- 4. Enable RLS on both tables
-- ===========================================
ALTER TABLE clarus.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarus.collection_items ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 5. RLS policies for clarus.collections
-- Uses (SELECT auth.uid()) subquery pattern for performance
-- ===========================================

-- SELECT: Users can view their own collections
CREATE POLICY "collections_select_own" ON clarus.collections
    FOR SELECT
    USING (user_id = (SELECT auth.uid()));

-- INSERT: Users can create their own collections
CREATE POLICY "collections_insert_own" ON clarus.collections
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE: Users can update their own collections
CREATE POLICY "collections_update_own" ON clarus.collections
    FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- DELETE: Users can delete their own collections
CREATE POLICY "collections_delete_own" ON clarus.collections
    FOR DELETE
    USING (user_id = (SELECT auth.uid()));

-- ===========================================
-- 6. RLS policies for clarus.collection_items
-- Users can manage items in their own collections (verified via join to collections)
-- ===========================================

-- SELECT: Users can view items in their own collections
CREATE POLICY "collection_items_select_own" ON clarus.collection_items
    FOR SELECT
    USING (
        collection_id IN (
            SELECT id FROM clarus.collections WHERE user_id = (SELECT auth.uid())
        )
    );

-- INSERT: Users can add items to their own collections
CREATE POLICY "collection_items_insert_own" ON clarus.collection_items
    FOR INSERT
    WITH CHECK (
        collection_id IN (
            SELECT id FROM clarus.collections WHERE user_id = (SELECT auth.uid())
        )
    );

-- UPDATE: Users can update items in their own collections
CREATE POLICY "collection_items_update_own" ON clarus.collection_items
    FOR UPDATE
    USING (
        collection_id IN (
            SELECT id FROM clarus.collections WHERE user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        collection_id IN (
            SELECT id FROM clarus.collections WHERE user_id = (SELECT auth.uid())
        )
    );

-- DELETE: Users can remove items from their own collections
CREATE POLICY "collection_items_delete_own" ON clarus.collection_items
    FOR DELETE
    USING (
        collection_id IN (
            SELECT id FROM clarus.collections WHERE user_id = (SELECT auth.uid())
        )
    );

-- ===========================================
-- 7. Trigger to update item_count on collections
-- ===========================================
CREATE OR REPLACE FUNCTION clarus.update_collection_item_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clarus
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE clarus.collections
        SET item_count = item_count + 1, updated_at = now()
        WHERE id = NEW.collection_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE clarus.collections
        SET item_count = GREATEST(item_count - 1, 0), updated_at = now()
        WHERE id = OLD.collection_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_collection_item_count ON clarus.collection_items;
CREATE TRIGGER trg_collection_item_count
    AFTER INSERT OR DELETE ON clarus.collection_items
    FOR EACH ROW
    EXECUTE FUNCTION clarus.update_collection_item_count();

-- ===========================================
-- 8. Trigger to update updated_at on collections
-- ===========================================
CREATE OR REPLACE FUNCTION clarus.update_collections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clarus
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collections_updated_at ON clarus.collections;
CREATE TRIGGER trg_collections_updated_at
    BEFORE UPDATE ON clarus.collections
    FOR EACH ROW
    EXECUTE FUNCTION clarus.update_collections_updated_at();
