-- 001_init.sql
-- Core schema for Meeting-to-Action Workflow Tool

CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled meeting',
    raw_notes TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | processing | reviewed | synced
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per generated item: a decision, a task, or a follow-up reminder.
-- Keeping these in one table (instead of 3 separate tables) keeps the
-- review/edit UI simple: it's just "list of items for this meeting".
CREATE TABLE IF NOT EXISTS action_items (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('decision', 'task', 'follow_up')),
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT,               -- free-text name/email; no user table for v1
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected | synced
    notion_page_id TEXT,      -- set once pushed to Notion
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id ON action_items(meeting_id);

-- Trigger to auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meetings_updated_at ON meetings;
CREATE TRIGGER trg_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_action_items_updated_at ON action_items;
CREATE TRIGGER trg_action_items_updated_at
    BEFORE UPDATE ON action_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
