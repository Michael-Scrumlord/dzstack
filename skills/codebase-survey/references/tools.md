# Survey tools

Run tools without adding them to the project: `npx -y`, `uvx`, `go run …@latest`, or a container. Write output to `raw/` in the survey folder and read only counts and top rows. If a tool won't run, record why in `04-static.md` and fall back to the next row or the grep checks.

## Any language

| Need | Tool | Run |
|---|---|---|
| Lines by language | scc, tokei, or `scripts/inventory.sh` | `scc --format json > raw/scc.json` |
| Complexity per function | lizard (most languages) | `uvx lizard -w -C 15 src > raw/lizard.txt` (warnings only: cyclomatic over 15) |
| Duplication | jscpd (most languages) | `npx -y jscpd --min-lines 8 --reporters json --output raw/jscpd src` |
| Security patterns | semgrep | `docker run --rm -v "$PWD:/src:ro" -w /src semgrep/semgrep semgrep scan --config auto --json > ../raw/semgrep.json`, or `uvx semgrep scan --config auto --json`. `--config auto` downloads rules from semgrep.dev; without that access, use the grep checks below |
| Secrets in history | gitleaks | `docker run --rm -v "$PWD:/r:ro" zricethezav/gitleaks git /r --no-banner` |
| Vulnerable dependencies | osv-scanner | `docker run --rm -v "$PWD:/src:ro" ghcr.io/google/osv-scanner scan -r /src` |
| Diagrams | Mermaid in Markdown | renders on GitHub and Gitea; keep graphs to 25 nodes, group by folder above that |

## By language

| Language | Import graph and cycles | Dead code | Lint and types | Dependencies |
|---|---|---|---|---|
| TypeScript, JavaScript | `npx -y madge --circular --extensions ts,tsx,js src`, and `--json` for the full graph. madge misses dynamic `import()`: grep for those and add them by hand. dependency-cruiser (`npx -y -p dependency-cruiser depcruise src -T json`) can report 0 modules on a TypeScript newer than it supports; trust madge then | `npx -y knip --reporter json > raw/knip.json` | the project's `eslint` and `tsc --noEmit` | `npm audit --json`, `npm outdated` |
| Python | `uvx pydeps <package> --show-cycles --no-output`; `uvx --from grimp python -c …` for a graph | `uvx vulture <package> --min-confidence 80` | the project's ruff/flake8, `uvx mypy`; `uvx radon cc -s -a <package>` | `uvx pip-audit` |
| Go | `go list -deps -json ./...`; cycles fail the build already | `go run golang.org/x/tools/cmd/deadcode@latest ./...` | `go vet ./...`, `go run honnef.co/go/tools/cmd/staticcheck@latest ./...` | `go run golang.org/x/vuln/cmd/govulncheck@latest ./...` |
| Rust | `cargo tree`, `cargo modules dependencies` (cargo-modules) | `cargo +nightly udeps` (unused crates); `#[allow(dead_code)]` grep | `cargo clippy -- -W clippy::pedantic` | `cargo audit` |
| Java, Kotlin | `jdeps -summary -recursive <jar>` | IDE inspections, PMD `UnusedPrivateMethod` | PMD, SpotBugs, detekt (Kotlin) | `gradle dependencies`, OWASP dependency-check |
| C# | project references in `.csproj`; NDepend if present | Roslyn IDE0051/IDE0052 | `dotnet build -warnaserror` with analyzers | `dotnet list package --vulnerable --include-transitive` |
| Shell | | | `shellcheck` (container `koalaman/shellcheck`) | |
| SQL, migrations | read the migrations in order; draw the `erDiagram` from them | tables nothing queries | | |

## Grep checks, for any language without an analyzer

Count each and list the top files. A hit is a candidate for the deep read, not a finding.

| Smell | Pattern (ripgrep) |
|---|---|
| Swallowed errors | `catch\s*(\([^)]*\))?\s*\{\s*\}`, `except[^:]*:\s*pass`, `_ = err`, `.catch\(\(\) => \{\}\)` |
| Debt markers | `TODO|FIXME|HACK|XXX` |
| Type escape hatches | `as any`, `: any\b`, `@ts-ignore`, `# type: ignore`, `unsafe`, `!!` |
| Disabled tests | `\.skip\(|\bxit\(|@Disabled|@Ignore|pytest\.mark\.skip` |
| Network calls with no timeout | `fetch\(` without `signal`, `requests\.(get|post)\(` without `timeout=`, `http\.Get\(` |
| Dynamic code | `eval\(|new Function\(|exec\(|pickle\.loads|yaml\.load\(` without a safe loader |
| Raw SQL built from strings | `(SELECT|INSERT|UPDATE|DELETE)[^;]*\$\{|" \+ |f".*(SELECT|WHERE)` |
| Hard-coded hosts and keys | `https?://[0-9]`, `localhost:[0-9]+`, `(api|secret)_?key\s*[:=]` |
| Sleeps in tests | `sleep\(|setTimeout\(` under test folders |
| Print debugging | `console\.log|print\(|fmt\.Println` outside scripts and CLIs |
