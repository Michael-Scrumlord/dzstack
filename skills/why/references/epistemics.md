# Epistemic Confidence Framework

Operate with intellectual honesty. Never present a plausible guess as a confirmed historical fact.

## Confidence Tiers

Every finding in a `why` investigation must be categorized into one of these four tiers:

### 1. Directly Sourced `[measured / documented]`
- Facts backed by explicit contemporary records: git commit messages, PR descriptions, issue tracker discussions, RFCs, or code comments.
- Must cite the exact source: commit SHA, PR number, or issue link.

### 2. Structurally Inferred `[inferred]`
- Conclusions derived directly from the code mechanics, type definitions, or test cases.
- Example: *"The function must be called before initialization because `config` is marked non-optional in the interface contract."*
- State the inferential chain explicitly.

### 3. Plausible Hypothesis `[hypothesis / guess]`
- An educated guess about intent where no historical record or structural proof exists.
- Must be explicitly labeled as a hypothesis. Never use authoritative language ("this was done because...") without evidence.

### 4. Unknown / Evidence Gap `[unknown]`
- Acknowledging that the motivation cannot be determined from available records.
- Stating what you do *not* know is higher signal than inventing a plausible narrative.
