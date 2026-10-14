---
name: principle-zero-dependency-inflation
description: "Apply when considering an external library or package. Prefer the standard library and code already in the repo; a dependency is a permanent maintenance, security and supply-chain cost."
disable-model-invocation: true
---

# Zero Dependency Inflation

Every dependency is code you run but did not read, updates you must track, and an attack surface you inherit.

**Why:** A package saves an afternoon once and costs attention forever: upgrades, breaking changes, advisories, licence checks, bundle size, install failures offline. Most needs are a few lines over the standard library.

**The pattern:**
- Check the standard library and the repo's existing utilities first
- Write the ten lines yourself when that is what the need is
- Add a package only for real depth (crypto, parsing a hard format, a protocol client, a test runner) and say why in the commit
- Pin exact versions; never `latest`
- One package per job: remove the old one in the same change that adds its replacement
- Prefer packages with no transitive dependencies
