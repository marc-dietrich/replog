-- V5: Client-side timestamps (created_at / updated_at) for all three
-- entity tables. Values are provided 1:1 by the client — the server
-- never overrides them. Nullable for legacy rows created before this
-- migration.

ALTER TABLE exercise_group ADD COLUMN created_at TIMESTAMPTZ;
ALTER TABLE exercise_group ADD COLUMN updated_at TIMESTAMPTZ;

ALTER TABLE exercise ADD COLUMN created_at TIMESTAMPTZ;
ALTER TABLE exercise ADD COLUMN updated_at TIMESTAMPTZ;

ALTER TABLE entry ADD COLUMN created_at TIMESTAMPTZ;
ALTER TABLE entry ADD COLUMN updated_at TIMESTAMPTZ;
