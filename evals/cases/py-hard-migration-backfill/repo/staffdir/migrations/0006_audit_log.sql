CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    subject_id INTEGER,
    detail TEXT
);

CREATE INDEX IF NOT EXISTS audit_log_subject ON audit_log (subject_id);

-- Changing an email address is always worth a line, whoever changed it.
DROP TRIGGER IF EXISTS users_email_changed;

CREATE TRIGGER users_email_changed AFTER UPDATE OF email ON users
WHEN OLD.email <> NEW.email
BEGIN
    INSERT INTO audit_log (actor, action, subject_id, detail)
    VALUES ('trigger', 'user.email_changed', NEW.id, OLD.email || ' -> ' || NEW.email);
END;
