# Results

Each comparison below says what ran. The numbers come from `run.py report`. A difference counts only when its 95% bootstrap interval excludes zero.

## 2026-11-03: the improve stack against main on a small model (Antigravity CLI, Gemini 3.8 Flash medium, 20 cases, 2 runs each)

`main` is dzstack at e044000, `stack` is `improve/4-perf-guard`; both engaged with "Use the daz-mode skill for this task." No vanilla or pstack arm, to save quota. All 80 runs were valid. The skill was read in 40 of 40 `main` runs and 37 of 40 `stack` runs.

| Arm | Pass rate | Mean score | Tool calls | Minutes | Output tokens |
|---|---|---|---|---|---|
| main | 90% | 0.90 | 52.2 | 6.9 | 60,530 |
| stack | 85% | 0.92 | 41.5 | 6.9 | 58,790 |

- **Score:** stack +0.016 [-0.005, +0.042]; better on 3 cases, worse on 2, tied on 15. No difference.
- **Steps:** stack makes 20% fewer tool calls in the same time.
- **Where they differ:** stack is ahead on the slow merge fix (it adds the guard test), the planted-defects review and the migration backfill; behind on the ambiguous ticket and the no-change rounding case.
- **Failures:** both fail the long CLI on every run (0.74 each time); the migration backfill fails on most runs of both.

So the stack's cuts don't crowd a small model, and its rules don't clearly help one either.

## 2026-11-03, step C: the improve/* stack against main (Claude Code, Sonnet, 20 cases, 3 runs each)

The branches are `improve/0-generic`, then `1-lean`, `2-docs-first`, `3-subtract` and `4-perf-guard`. They were built by a cloud session that never saw these cases.

| Arm | Pass rate | Mean score | Cost per run | Turns | Cache read | Output tokens |
|---|---|---|---|---|---|---|
| vanilla | 85% | 0.86 | $0.114 | 5.8 | | 4,061 |
| main (dzstack) | 88% | 0.92 | $0.197 | 7.7 | 238k | 6,484 |
| pstack | 87% | 0.90 | $0.167 | 6.7 | | 4,928 |
| lean (level 1) | 85% | 0.90 | $0.143 | 6.5 | 166k | 4,822 |
| **stack (level 4)** | **88%** | **0.94** | **$0.146** | 6.7 | 172k | 4,986 |

The paired comparisons, per case, with 95% intervals:
- **Stack against vanilla:** score +0.079 [+0.031, +0.145], better on 11 cases and worse on 3; cost +28%.
- **Stack against pstack:** score +0.034 [+0.005, +0.070]; cost -$0.020 per run [-0.033, -0.008]. **Stack beats pstack on both.**
- **Stack against main:** score +0.021 [-0.001, +0.047], just short; cost -$0.051 per run [-0.065, -0.037], which is -26%.
- **Lean against main:** score -0.016 [-0.060, +0.017], no difference; cost -27%. Levels 2 to 4 bring the score back up at no extra cost.

Where the targeted rules show:
- **Speed fix with a guard test:** stack scores 1.00 on the perf case, every other arm 0.83.
- **Documented behavior kept:** stack passes the traversal case 3 of 3; lean and pstack pass 1 of 3.
- **Refactors shrink:** lean and stack score 0.97, against 0.90.

Where it is weaker:
- **The double-release race:** stack passes 1 of 3, where main and pstack pass 2 of 3.
- **The migration case:** stack scores 0.71, where lean scores 0.82.

## 2026-11-03: dzstack (main at e044000) vs pstack-claude (513c088) vs no pack

### Claude Code, Sonnet

| Cases | Runs | vanilla | dzstack | pstack |
|---|---|---|---|---|
| 12 standard | 3 per case | pass 100%, score 0.89, $0.061/run | pass 94%, score 0.91, $0.123/run | pass 97%, score 0.91, $0.098/run |
| 8 hard | 3 per case | pass 71%, score 0.84, $0.195/run | pass 71%, **score 0.92** (+0.080, interval +0.011 to +0.191), $0.308/run | pass 75%, score 0.91 (+0.065, interval -0.022 to +0.190), $0.272/run |

- **Hard cases:** dzstack is better than no pack, with a difference that holds up. It was better on 5 of 8 cases and worse on none. pstack is close to dzstack. They win different cases:
  - pstack solved the double-release race (2 of 3 runs, where the other two arms solved none);
  - dzstack solved the long CLI (2 of 3, where pstack solved none).
- **Standard cases:** the arms tie on outcome. Both packs add a regression test that fails on the old code far more often: vanilla 11 of 24, dzstack 22 of 24, pstack 20 of 24.
- **Cost:** dzstack costs the most, 1.6 to 2 times vanilla per run. The cost comes from a larger context (about 10k more tokens written to cache) multiplied by more steps.
- **Seen on both models:**
  - no refactor shrank the code;
  - no speed fix shipped with a guard test (Haiku);
  - the packs sometimes changed documented behavior, such as a 403 becoming a 404.

### Claude Code, Haiku (standard cases, 2 runs)

vanilla 92% / 0.88, dzstack 100% / 0.95, pstack 96% / 0.92. The differences are not significant.

### Antigravity CLI (`agy` 1.4.12), all 20 cases

| Model | Valid runs | vanilla | dzstack | pstack |
|---|---|---|---|---|
| Gemini 3.8 Flash, low effort, 2 runs | 87 of 120 | 79%, 0.83 | 70%, 0.83 | 78%, 0.83 |
| GPT-OSS 120B, medium, 1 run | 37 of 60 | 67%, 0.53 | 27%, 0.46 | 29%, 0.42 |

- **Missing runs:** they ended in provider errors, either quota (429) or no capacity (503). The harness now retries or stops on those and never scores them. Run the pass again to fill them in.
- **Flash:** the packs make no difference to outcome. dzstack takes more steps, 51 against vanilla's 40.
- **GPT-OSS:** with dzstack it does less work, writing about half the output tokens. Too few paired cases survived to tell more.

## What to change in dzstack, from this

1. **Context and steps.** Cut both on simple tasks, the largest cost. The `improve/1-lean` brief covers this.
2. **Documented behavior.** Read and keep it, such as status codes and formats, before changing behavior.
3. **Refactors that shrink.** Count lines before and after, and justify any growth.
4. **Speed fixes.** Ship a guard test with each one.
5. **Smaller models.** Check every change on a small model (Flash low, GPT-OSS). A pack that helps Sonnet can crowd a small model.
