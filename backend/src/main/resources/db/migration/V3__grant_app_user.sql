-- V3: Grant replog_app access to the app_user table.
-- The table was created in V2 but no permissions were granted to
-- the application user.

GRANT SELECT, INSERT, UPDATE, DELETE ON app_user TO replog_app;
