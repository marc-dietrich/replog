-- RepLog PostgreSQL Schema
-- Matches the frontend data structure and user authentication

-- ============================================================
--  USERS TABLE
-- ============================================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  sub VARCHAR(255) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('guest', 'google')),
  email VARCHAR(255),
  display_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_sub ON users(sub);
CREATE INDEX idx_users_provider ON users(provider);


-- ============================================================
--  GROUPS TABLE
--  Exercise grouping (e.g., "Push", "Pull", "Legs")
-- ============================================================
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

CREATE INDEX idx_groups_user_id ON groups(user_id);


-- ============================================================
--  EXERCISES TABLE
--  Individual exercises (e.g., "Bench Press", "Squats")
-- ============================================================
CREATE TABLE exercises (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  group_id VARCHAR(255),
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, exercise_id)
);

CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE INDEX idx_exercises_group_id ON exercises(user_id, group_id);


-- ============================================================
--  ENTRIES TABLE
--  Individual workout entries (sets/reps for an exercise)
-- ============================================================
CREATE TABLE entries (
  id SERIAL PRIMARY KEY,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  date DATE NOT NULL,
  weight NUMERIC(10, 2) NOT NULL,
  reps INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_entries_exercise_id ON entries(exercise_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_date ON entries(user_id, date);


-- ============================================================
--  SETTINGS TABLE
--  User preferences
-- ============================================================
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_view_mode VARCHAR(50) DEFAULT 'topSet' CHECK (exercise_view_mode IN ('topSet', 'volume', 'sets')),
  sets_display_mode VARCHAR(50) DEFAULT 'continuous' CHECK (sets_display_mode IN ('continuous', 'discrete')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_user_id ON settings(user_id);


-- ============================================================
--  DATABASE BACKUPS METADATA TABLE
--  For tracking backup history
-- ============================================================
CREATE TABLE backup_history (
  id SERIAL PRIMARY KEY,
  backup_name VARCHAR(255) NOT NULL UNIQUE,
  backup_path VARCHAR(512),
  backup_size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
--  MIGRATION TOKENS TABLE
--  For secure data migration between instances
-- ============================================================
CREATE TABLE migration_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_migration_tokens_user_id ON migration_tokens(user_id);
CREATE INDEX idx_migration_tokens_expires_at ON migration_tokens(expires_at);


-- ============================================================
--  UTILITY: Update timestamp function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to all tables
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER exercises_updated_at BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER entries_updated_at BEFORE UPDATE ON entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER backup_history_updated_at BEFORE UPDATE ON backup_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER migration_tokens_updated_at BEFORE UPDATE ON migration_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
