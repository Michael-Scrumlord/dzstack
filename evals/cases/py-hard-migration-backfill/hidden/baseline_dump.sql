BEGIN TRANSACTION;
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    subject_id INTEGER,
    detail TEXT
);
CREATE TABLE schema_migrations ( version TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
INSERT INTO "schema_migrations" VALUES('0001','create_users','2026-11-03T04:02:42Z');
INSERT INTO "schema_migrations" VALUES('0002','create_teams','2026-11-03T04:02:42Z');
INSERT INTO "schema_migrations" VALUES('0003','user_status','2026-11-03T04:02:42Z');
INSERT INTO "schema_migrations" VALUES('0004','team_roster_view','2026-11-03T04:02:42Z');
INSERT INTO "schema_migrations" VALUES('0005','user_phone','2026-11-03T04:02:42Z');
INSERT INTO "schema_migrations" VALUES('0006','audit_log','2026-11-03T04:02:42Z');
CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    lead_user_id INTEGER REFERENCES users (id)
);
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    full_name TEXT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
, team_id INTEGER REFERENCES teams (id), status TEXT NOT NULL DEFAULT 'active', phone TEXT);
CREATE INDEX users_full_name ON users (full_name COLLATE NOCASE);
CREATE INDEX users_team ON users (team_id);
CREATE VIEW team_roster AS
SELECT u.id AS user_id,
       u.team_id AS team_id,
       u.full_name AS full_name,
       u.email AS email,
       u.status AS status
FROM users u
WHERE u.team_id IS NOT NULL;
CREATE INDEX audit_log_subject ON audit_log (subject_id);
CREATE TRIGGER users_email_changed AFTER UPDATE OF email ON users
WHEN OLD.email <> NEW.email
BEGIN
    INSERT INTO audit_log (actor, action, subject_id, detail)
    VALUES ('trigger', 'user.email_changed', NEW.id, OLD.email || ' -> ' || NEW.email);
END;
COMMIT;
