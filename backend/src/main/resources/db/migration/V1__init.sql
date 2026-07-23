DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'replog_app') THEN
        CREATE ROLE replog_app LOGIN PASSWORD 'replog_app';
    END IF;
END
$$;

CREATE TABLE exercise_group (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER
);

CREATE TABLE exercise (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER,
    group_id UUID REFERENCES exercise_group(id)
);

CREATE TABLE entry (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE,
    weight NUMERIC(6,2),
    reps INTEGER,
    note VARCHAR(1000),
    exercise_id UUID NOT NULL REFERENCES exercise(id)
);

-- ===== Row Level Security =====

ALTER TABLE exercise_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_group FORCE ROW LEVEL SECURITY;

ALTER TABLE exercise ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise FORCE ROW LEVEL SECURITY;

ALTER TABLE entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry FORCE ROW LEVEL SECURITY;

CREATE POLICY exercise_group_isolation ON exercise_group
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY exercise_isolation ON exercise
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY entry_isolation ON entry
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);


GRANT USAGE ON SCHEMA public TO replog_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON exercise_group, exercise, entry TO replog_app;