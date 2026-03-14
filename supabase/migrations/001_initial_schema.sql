-- =============================================================================
-- FocusFlow Initial Schema
-- Creates all tables, enums, indexes, RLS policies, and helper functions
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================

CREATE TYPE task_quadrant AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'UNCLASSIFIED');
CREATE TYPE task_status   AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
CREATE TYPE source_type   AS ENUM ('MANUAL', 'CALENDAR', 'EMAIL', 'BRAIN_DUMP');
CREATE TYPE reminder_type AS ENUM ('CHAIN_1H', 'CHAIN_30M', 'CHAIN_10M', 'CHAIN_5M');

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- Users table
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  role        TEXT        DEFAULT 'user',
  preferences JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Tasks table
CREATE TABLE tasks (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT          NOT NULL,
  description     TEXT,
  quadrant        task_quadrant DEFAULT 'UNCLASSIFIED',
  status          task_status   DEFAULT 'PENDING',
  energy_cost     INTEGER       DEFAULT 3 CHECK (energy_cost >= 1 AND energy_cost <= 5),
  due_date        TIMESTAMPTZ,
  source_type     source_type   DEFAULT 'MANUAL',
  source_id       TEXT,
  ai_reason       TEXT,
  parent_task_id  UUID          REFERENCES tasks(id) ON DELETE SET NULL,
  position        INTEGER       DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now()
);

-- Email metadata table
CREATE TABLE email_metadata (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL,
  subject     TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL
);

-- Streaks table
CREATE TABLE streaks (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak      INTEGER DEFAULT 0,
  longest_streak      INTEGER DEFAULT 0,
  last_completed_date DATE,
  UNIQUE(user_id)
);

-- Reminders table
CREATE TABLE reminders (
  id        UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id   UUID          NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ   NOT NULL,
  type      reminder_type NOT NULL,
  sent      BOOLEAN       DEFAULT false
);

-- =============================================================================
-- 3. INDEXES
-- =============================================================================

CREATE INDEX idx_tasks_user_id   ON tasks(user_id);
CREATE INDEX idx_tasks_quadrant  ON tasks(user_id, quadrant);
CREATE INDEX idx_tasks_status    ON tasks(user_id, status);
CREATE INDEX idx_tasks_due_date  ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_reminders_remind_at ON reminders(remind_at) WHERE sent = false;

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders      ENABLE ROW LEVEL SECURITY;

-- 4a. users policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4b. tasks policies
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- 4c. email_metadata policies (access through task ownership)
CREATE POLICY "Users can view own email metadata"
  ON email_metadata FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = email_metadata.task_id AND tasks.user_id = auth.uid())
  );

CREATE POLICY "Users can create own email metadata"
  ON email_metadata FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = email_metadata.task_id AND tasks.user_id = auth.uid())
  );

-- 4d. streaks policies
CREATE POLICY "Users can view own streaks"
  ON streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own streaks"
  ON streaks FOR ALL
  USING (auth.uid() = user_id);

-- 4e. reminders policies (access through task ownership)
CREATE POLICY "Users can view own reminders"
  ON reminders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = reminders.task_id AND tasks.user_id = auth.uid())
  );

CREATE POLICY "Users can manage own reminders"
  ON reminders FOR ALL
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = reminders.task_id AND tasks.user_id = auth.uid())
  );

-- =============================================================================
-- 5. AUTO-CREATE USER PROFILE ON SIGNUP
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- 6. UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
