# The store file

One JSON file (default `./tasks.json`, see `docs/SPEC.md` for how to point somewhere else), written with two-space indentation and a final newline.

```json
{
  "version": 1,
  "nextId": 4,
  "tasks": [
    {
      "id": 1,
      "title": "Buy milk",
      "status": "open",
      "priority": "normal",
      "due": "2026-05-03",
      "tags": ["home"],
      "note": null,
      "createdAt": "2026-05-01",
      "completedAt": null
    }
  ],
  "journal": []
}
```

- `version` is 1. A file with another version is refused.
- `nextId` is the id the next task gets. It is always higher than every id in `tasks`, and ids are never reused.
- A task has exactly the fields above. `status` is `open` or `done`; `priority` is `high`, `normal` or `low`; `due`, `createdAt` and `completedAt` are `YYYY-MM-DD` strings (`due` and `completedAt` may be `null`); `tags` is a list of strings; `note` is a string or `null`.
- `journal` lists the changes `undo` can take back, oldest first. Files written before the journal existed have no `journal`; it is read as empty.
- A missing file is an empty store: `{ "version": 1, "nextId": 1, "tasks": [], "journal": [] }`. The file is created by the first command that changes something.
