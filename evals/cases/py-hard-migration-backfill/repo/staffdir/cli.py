"""The command line: python -m staffdir [--db PATH] <command>.

  migrate                              apply pending migrations
  users list [--q Q] [--team ID] [--sort name|email|created]
  users show ID
  users add --name "Full Name" --email ADDRESS [--team ID]
  export users                         CSV on standard output
  report index                         the A-Z index
"""
from __future__ import annotations

import argparse
import sys

from . import db, exports, migrate, reports, users
from .validation import ValidationError, clean_email, clean_full_name


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="staffdir")
    parser.add_argument("--db", help="database file (default: $STAFFDIR_DB or ./staffdir.db)")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate")

    user_cmd = commands.add_parser("users").add_subparsers(dest="action", required=True)
    listing = user_cmd.add_parser("list")
    listing.add_argument("--q")
    listing.add_argument("--team", type=int)
    listing.add_argument("--sort", default="name", choices=sorted(users.SORTS))
    show = user_cmd.add_parser("show")
    show.add_argument("id", type=int)
    add = user_cmd.add_parser("add")
    add.add_argument("--name", required=True)
    add.add_argument("--email", required=True)
    add.add_argument("--team", type=int)

    commands.add_parser("export").add_argument("what", choices=["users"])
    commands.add_parser("report").add_argument("what", choices=["index"])
    return parser


def format_user(user: dict) -> str:
    return f"{user['id']:>4}  {user['full_name'] or '(no name)'}  <{user['email']}>"


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    conn = db.connect(args.db)
    try:
        return _run(conn, args)
    except ValidationError as error:
        print(f"staffdir: {error.message}", file=sys.stderr)
        return 2
    finally:
        conn.close()


def _run(conn, args) -> int:
    if args.command == "migrate":
        applied = migrate.run(conn)
        print("applied: " + (", ".join(applied) if applied else "nothing to do"))
    elif args.command == "users":
        return _users(conn, args)
    elif args.command == "export":
        sys.stdout.write(exports.users_csv(conn))
    elif args.command == "report":
        for initial, members in reports.index_by_initial(conn).items():
            print(f"{initial}  " + ", ".join(m["full_name"] or m["email"] for m in members))
    return 0


def _users(conn, args) -> int:
    if args.action == "list":
        for user in users.list_users(conn, q=args.q, team_id=args.team, sort=args.sort, limit=1000):
            print(format_user(user))
    elif args.action == "show":
        user = users.get(conn, args.id)
        if user is None:
            print(f"staffdir: no user {args.id}", file=sys.stderr)
            return 1
        print(format_user(user))
        print(f"      team {user['team_id'] or '-'}, status {user['status']}, phone {user['phone'] or '-'}")
    elif args.action == "add":
        user = users.create(
            conn,
            full_name=clean_full_name(args.name),
            email=clean_email(args.email),
            team_id=args.team,
            actor="cli",
        )
        print(format_user(user))
    return 0
