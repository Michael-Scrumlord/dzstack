### Perf issue

You own the measurement. Tie every fix to a number; don't read source instead of measuring.

1. **Baseline.** Measure with the project's `verify-<app>` skill if one exists, else Playwright/CDP for web, PTY/tmux for CLIs (see `multi-phase-plan.md`, "Control skill"), else a 10-line timing script kept with the PR.
2. **Hypothesize.** Use `how` to ground hypotheses. Try a strategy only when the trace shows its signal:
   - **Elimination:** the work has no consumer. The profiler can't show this; `how` can.
   - **Divide and conquer:** cost scales with input. Chunk, prune or parallelize.
   - **Caching:** identical inputs recompute. Name what invalidates the cache.
   - **Indirection:** an index instead of a scan, a queue off the hot thread.
   - **Batching:** many small calls each pay a fixed overhead.
   - **Redundancy:** one slow replica dominates and there is headroom. Hedge.
   - **Lazy evaluation:** results computed before they are needed, or never used.
   - **Scheduling:** necessary work during the interactive moment. Move it to idle time and measure the interactive path.
3. **Fix.** If it crosses a function boundary, `architect` first. Delegate to the `perf-issue` model role when the change is large (model file: `.dzstack/models.md` or `~/.agents/daz-models.md`). One attempt at a time, each measured (**principle-sequence-verifiable-units**).
4. **Guard test.** Add a test that fails if the slow behavior returns. Either run at a size where the old code is clearly too slow, under a time limit several times the new code's runtime, or check growth: time n and 4n and fail if the ratio shows the old complexity (quadratic gives about 16, linear about 4, so fail above 8). Run it against the old code and see it fail.
5. **Compare.** Post-fix measurement against the baseline on the same surface. "Inconclusive" or wrong-surface is not a pass.
6. Cite the numbers in the PR and run **Opening a PR**.

Sustained work against one metric: `playbooks/hillclimb.md`.

**Reply:** baseline, post-fix number, delta, the guard test and its result on the old code.
