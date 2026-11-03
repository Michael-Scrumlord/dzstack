# Names

## How a name is stored

- `given_name` and `family_name`: `TEXT`, nullable. `NULL` means "not split yet" (only rows written by a release that predates the columns); `''` means "no value".
- `full_name`: the old single-string column. It stays until a later release drops it. From the release that adds the two columns on, every write sets it to the **display name**, so an old release reading it keeps working.
- The **display name** is `given_name` and `family_name` joined with one space, leaving out one that is empty: "Mary Jane" + "Watson" is `Mary Jane Watson`; "Cher" + "" is `Cher`; "" + "" is `''`.
- Characters in a name are never changed: no case change, no Unicode normalization, nothing removed from the inside of a name.

## Reading one string as a name

This is how the backfill, input that only has a `full_name`, and rows whose parts are still `NULL` get a given and a family name. Apply the rules in order.

1. `NULL`, an empty string or only whitespace: given `''`, family `''`.
2. Whitespace. Any Unicode whitespace separates words (space, tab, newline, no-break space, ideographic space). Runs of it count as one, and both ends are trimmed. Words are put back together with one ASCII space.
3. A comma means the legacy "Family, Given" format (rows imported from the old CRM). The text before the first comma is the family name (it may be several words), the text after it is the given name (commas in it stay). Both sides are trimmed. If either side is empty, the comma is dropped and what is left is read by rule 4.
4. Without a comma, split into words. One word is a given name and nothing else (family `''`). With more, the last word is the family name and the words before it are the given name.
5. Particles. A run of these words directly before the last word belongs to the family name: `van`, `von`, `der`, `den`, `de`, `del`, `della`, `di`, `da`, `du`, `la`, `le`, `bin`, `ibn` (compared ignoring case, with Unicode case folding). The first word always stays in the given name, even when it is a particle.

| Text | Given | Family |
|---|---|---|
| `Ada Lovelace` | `Ada` | `Lovelace` |
| `Cher` | `Cher` | `` |
| `Mary Jane Watson` | `Mary Jane` | `Watson` |
| `  Mary   Jane  Watson ` | `Mary Jane` | `Watson` |
| `Watson, Mary Jane` | `Mary Jane` | `Watson` |
| `van der Berg, Vincent` | `Vincent` | `van der Berg` |
| `Ludwig van Beethoven` | `Ludwig` | `van Beethoven` |
| `Anna Maria de la Cruz` | `Anna Maria` | `de la Cruz` |
| `van Halen` | `van` | `Halen` |
| `José Álvarez` | `José` | `Álvarez` |
| `Watson,` | `Watson` | `` |

## Where names show up

- Everything that shows a user's name as one string uses the display name. Where there is no name at all it falls back to the email address, as it did before.
- A user in an API response carries `given_name`, `family_name` and `full_name` (the display name). So do team leads and roster members.
- `POST /users` and `PATCH /users/<id>` take either `full_name` (read with the rules above) or `given_name` and/or `family_name`; mixing the two kinds is a 400 on field `full_name`. Parts are trimmed and their inner whitespace collapsed. A user always keeps at least one non-empty part (otherwise 400, field `given_name`). A `PATCH` with one part leaves the other as it is.
- Lists sorted by `name` go by family name, then given name (ignoring case, as before), then id.
- The search `q` finds a user whose given name, family name, or display name contains it (ignoring case).
- The A-Z index groups by the first letter of the family name, or of the given name when there is no family name; upper-cased. No letter or no name: `#`.
- The welcome message greets with `Hi <given name>,` (the whole given name; the family name when the given name is empty; `there` when both are).
- The CSV export has `given_name` and `family_name` columns. `full_name` stays in it, holding the display name, because spreadsheets depend on it.
- Until the final `migrate` of a rollout, SQL ordering and searching may treat a `NULL` part as empty. Python code reading rows reads them correctly (see `docs/migrations.md`, "Rollout").
