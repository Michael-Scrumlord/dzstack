# release-picker

The version logic behind our self-updater: given the release tags a project has published, pick the newest one and say whether it is newer than the version that is running.

- `src/semver.ts` parses and compares versions. It implements [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
- `src/updater.ts` picks the newest tag and checks for an update.

## Versions

A version is `MAJOR.MINOR.PATCH`, optionally followed by `-PRERELEASE` and `+BUILD`, as the spec defines it (items 2 to 10):

- The three numbers are required, non-negative integers without leading zeros.
- The pre-release is one or more dot-separated identifiers made of ASCII letters, digits and hyphens. No identifier is empty, and an identifier of only digits has no leading zeros.
- The build metadata is dot-separated identifiers of the same characters. None is empty. Digits-only identifiers may have leading zeros.
- Nothing else is allowed: no whitespace, and no `v` prefix. Release tags usually start with `v` (`v1.4.0`), so the updater strips one leading `v` before parsing; the parser itself rejects it.

## Precedence

As in spec item 11:

- Compare major, minor and patch numerically.
- A pre-release version is lower than the same version without one.
- Pre-release identifiers are compared one by one from the left. Digits-only identifiers are compared numerically. Identifiers with letters or hyphens are compared lexically in ASCII order. A digits-only identifier is always lower than one with letters or hyphens.
- If all the shared identifiers are equal, the version with more identifiers is higher.
- Build metadata is ignored: versions that differ only in build metadata have equal precedence.

## API

`src/semver.ts`

- `parseVersion(text)` returns a `Version` (`major`, `minor`, `patch`, `prerelease` and `build` as arrays of identifier strings) or throws `InvalidVersionError`.
- `tryParseVersion(text)` is the same but returns `null` for text that isn't a version.
- `isValidVersion(text)`, `formatVersion(version)`.
- `compareVersions(a, b)` takes strings or `Version`s and returns -1, 0 or 1. It throws `InvalidVersionError` for a string that isn't a version.
- `sortVersions(list)` returns a new list, lowest precedence first.

`src/updater.ts`

- `pickNewest(tags, { includePrerelease })` returns `{ newest, skipped }`. `newest` is the tag (as given) with the highest precedence, or `null`. Pre-releases are ignored unless `includePrerelease` is true. When several tags have equal precedence, the one listed first wins. `skipped` lists the tags that aren't valid versions.
- `findUpdate(current, tags, options)` returns the newest tag when it is newer than `current`, otherwise `null`.

## Tests

`npm test` (Node 24, no dependencies).
