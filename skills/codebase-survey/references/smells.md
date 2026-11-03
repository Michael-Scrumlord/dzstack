# Smells checklist for the deep read

Each row says what to look for and which artifact usually reveals it first. A smell is worth an entry when it has a `file:line` and a reason it makes a defect likely or a change costly. "This could be cleaner" is not a finding.

## Architecture

| Smell | Look for | Shows up in |
|---|---|---|
| Import cycle | modules that import each other, directly or around a loop | 03-deps |
| Layer violation | storage code importing UI, a domain module importing a framework | 03-deps against the 02-map layering |
| God module | high fan-in and high fan-out, many unrelated responsibilities | 03-deps, 01 largest files |
| Hidden coupling | files in different modules that always change together | 01 change-together table |
| Shotgun surgery | one concept spread across many files, each change touching all of them | 01 change-together, deep read |
| Duplicated logic | the same rule implemented twice, drifting apart | jscpd, deep read |
| Dead code | exports, files or routes nothing reaches | knip, vulture, deadcode, orphans in 03-deps |

## Code

| Smell | Look for | Shows up in |
|---|---|---|
| Long, branchy functions | cyclomatic complexity over 15, nesting over 4 | lizard, radon |
| Boolean or mode parameters | `f(x, true, false)` that switch behavior inside | deep read |
| Primitive obsession | strings or numbers standing for ids, money, units, states | deep read, data model |
| State duplicated | the same fact stored in two places that can disagree | deep read, data model |
| Hidden temporal coupling | call A before B or it breaks, with nothing enforcing it | flows |
| Type escape hatches | `any`, casts, ignores at module boundaries | grep checks, typecheck |

## Reliability (where most defects hide)

| Smell | Look for | Shows up in |
|---|---|---|
| Swallowed errors | empty catch, errors logged and dropped, fallbacks that hide failure | grep checks, deep read |
| Unchecked results | ignored return codes, unawaited promises, unhandled rejections | lint, deep read |
| No timeouts or limits | network calls, queues, retries, uploads with no bound | grep checks, flows |
| Partial failure | a multi-step write with no transaction or compensation | flows, data model |
| Resource leaks | files, sockets, timers, listeners opened on one path and not closed on the error path | deep read |
| Races | shared mutable state, check-then-act, two writers to one row without a version | flows, deep read |
| Time and locale | naive dates, local time zones on servers, float money | deep read |
| Lost write on teardown | a debounced save or timer cleared, not flushed, when a screen closes or the page hides | deep read of client screens |
| Out-of-order responses | an async result applied without checking it still belongs to the latest request (no counter, no abort) | deep read of search and autosave code |
| Parse before status | a response body parsed before its status is checked, so an HTML error page throws a raw parse error | deep read of the API client |
| Limits that disagree | the same rule (a range, a cap, a length) enforced differently in two layers | grep the constant in each layer |
| Domain input wrongly rejected | a parser or validator that refuses valid real-world input | phase 7 with the domain's real vocabulary |

## Security

| Smell | Look for | Shows up in |
|---|---|---|
| Injection | SQL, shell or HTML built from input | semgrep, grep checks |
| Path traversal | file paths from input without a resolved-prefix check | semgrep, deep read |
| SSRF | URLs from input fetched by the server without an allowlist | flows |
| Missing authorization | a route that checks login but not ownership | flows, deep read |
| Secrets | keys or tokens in code or history | gitleaks |
| Unsafe parsing | `eval`, unsafe YAML or pickle loads, unbounded input sizes | grep checks |

## Tests and operations

| Smell | Look for | Shows up in |
|---|---|---|
| Untested hotspot | a top-10 hotspot with few or no tests | 05 hotspots against test files |
| Tests that can't fail | assertions on mocks only, no assertion, snapshot-only | deep read |
| Flaky timing | sleeps, wall-clock thresholds, order-dependent tests | grep checks |
| Config drift | settings read from several places, defaults that differ by environment | deep read |
| Unpinned or abandoned dependencies | floating versions, packages with no release in years | 03-deps |
