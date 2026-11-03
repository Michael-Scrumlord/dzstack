CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    lead_user_id INTEGER REFERENCES users (id)
);

ALTER TABLE users ADD COLUMN team_id INTEGER REFERENCES teams (id);

CREATE INDEX users_team ON users (team_id);
