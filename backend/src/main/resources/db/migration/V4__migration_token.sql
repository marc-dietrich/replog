-- V4: Add migration token support to app_user.
-- Makes username/password nullable so migrated (unclaimed) users can exist
-- without credentials until they claim their account via the claim endpoint.

ALTER TABLE app_user
    ALTER COLUMN username DROP NOT NULL,
    ALTER COLUMN password DROP NOT NULL;

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS migration_token UUID UNIQUE;

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS migration_token_created_at TIMESTAMPTZ;
