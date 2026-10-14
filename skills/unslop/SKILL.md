---
name: unslop
description: Eliminate AI tells, conversational padding, hyperbolic jargon, and token-wasting fluff. Must always apply to all prose, PRs, and messages.
---

# Unslop

Edit technical prose to eliminate AI patterns. Concise, direct, and factual communication only.

## The Process
1. **Scan:** Identify AI stylistic tells, passive hedging, and repetitive fluff.
2. **Rewrite:** Strip filler, preserve technical meaning, and write with active, direct phrasing.
3. **Token Audit:** Ask: *"Does this sentence earn its token cost?"* If it can be stated in fewer words or replaced with a concrete metric, do so.

---

## Patterns to Detect and Fix

### 1. Language & Vocabulary Tells
- **Banned AI buzzwords:** *additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant*. Replace with plain, precise words.
- **Inflated ways to say "is" or "has":** *"serves as", "stands as", "boasts", "features"*. Just write *"is"* or *"has"*.
- **The "Not just X, but Y" trope:** Avoid dramatic contrasts. State the point directly.
- **Synonym cycling:** Switching between *utility, helper, tool, wrapper* across sentences. Pick the accurate technical term and stick with it.
- **Rule of three:** Forcing lists into threes for poetic cadence. Use the natural count.

### 2. Conversational Artifacts & Sycophancy
- **Chatbot pleasantries:** Ban *"Certainly!"*, *"I'd be happy to help!"*, *"Let me know if you need anything else!"*, *"I have updated line X to..."*. Output the code, diff, or answer directly.
- **Sycophantic validation:** Ban *"Great question!"*, *"You are absolutely right!"*. State your technical findings neutrally.
- **Excessive hedging:** Replace *"could potentially possibly be seen as"* with *"may"* or *"is"*.

### 3. Punctuation & Formatting Tells
- **The em-dash ban (`—`):** Avoid em-dashes completely. Use standard periods or commas. One clear thought per sentence.
- **Mid-sentence colons:** Colons are permitted only before an enumerated list or code block, never as mid-sentence connectors.
- **Boldface clutter:** Do not bold every proper noun, framework name, or acronym.
- **Emoji purge:** Strip all decorative emojis (🚀, 💡, 🔥, ✨) from technical headings, commits, and summaries.
- **Straight quotes:** Replace decorative curly quotes (`“` `”`) with standard straight quotes (`"` `'`).

### 4. Jargon & Fluff Elimination
- **Corporate metaphors:** Eliminate *flywheel, north star, paradigm, synergy, bedrock, scaffolding (as metaphor), substrate, vector (metaphor)*. Use concrete engineering terms (*architecture, mechanism, baseline, approach*).
- **Say what it does, not how it feels:** Avoid vague claims like *"the database is fast and responsive"*. State the mechanism or measurement: *"queries execute in 8ms with indexed lookups"*.
- **Plain verbs over fancy synonyms:** Replace *utilize* with *use*, *leverage* with *use*, *facilitate* with *help*, *in order to* with *to*.
- **Active voice:** Prefer active constructions: *"the parser validates the token"* instead of *"the token is validated by the parser"*.

---

## Token Efficiency Rule

Every token spent is a tax on context window capacity and reading latency.
- Cut introductory and concluding throat-clearing.
- Prefer a compact markdown table or bulleted specification over three paragraphs of narrative prose.
