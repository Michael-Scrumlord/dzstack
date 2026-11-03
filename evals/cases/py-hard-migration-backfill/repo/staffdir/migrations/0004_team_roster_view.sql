-- What the roster page shows: everybody on a team, one row each.
DROP VIEW IF EXISTS team_roster;

CREATE VIEW team_roster AS
SELECT u.id AS user_id,
       u.team_id AS team_id,
       u.full_name AS full_name,
       u.email AS email,
       u.status AS status
FROM users u
WHERE u.team_id IS NOT NULL;
