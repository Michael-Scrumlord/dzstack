### UI & Visual Parity Playbook

**You own pixel-exact visual fidelity. The baseline is the specification; it is sacred and untouchable.** 

Visual equivalence is verified by image comparison or computed DOM layout metrics: never by human eyeball or text-only assumptions.

---

### Execution Steps

1. **Establish the Baseline First (Blocking Prerequisite).**
   - Take screenshots of the current component/screen *before* touching a single line of styling code.
   - **Dual-Viewport Rule:** Capture the baseline across at least two viewports, plus every target size the project names (its design widths, the user's window, the phone it is built for):
     - **Desktop:** 1280px width
     - **Mobile:** 375px width (ensures responsive layouts do not break silently)
   - **State Coverage:** Capture the component across its operational states (Default, Loading, Empty, Error, Stress). States that don't apply (an Empty state on a marketing page): say so and why, in one line, instead of skipping silently.
   - **Live surfaces** (WebGL, canvas, particles, GSAP timelines, cursor parallax) never render two identical frames. Before any baseline, **pin time and randomness**: a debug hook such as `?still=<seconds>` that freezes the animation clock at a given time, seeds every random source, and ignores the pointer. If the project has none, adding it is the first change. Surfaces that cannot be pinned get a region mask in the diff, and the mask is recorded with the baseline; it is never widened later.
     - **Reference `?still=<seconds>` hook (drop in at app entry):**
       ```ts
       const stillParam = new URLSearchParams(location.search).get("still");
       if (stillParam !== null) {
         const tSec = Number(stillParam) || 0;
         const tMs = tSec * 1000;
         let seed = 0x2f6e2b1;
         Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
         performance.now = () => tMs;
         window.requestAnimationFrame = (cb) => (cb(tMs), 0);
         (window as { gsap?: { globalTimeline: { pause: () => unknown; time: (t: number) => unknown } } })
           .gsap?.globalTimeline.pause().time(tSec);
         const s = document.createElement("style");
         s.textContent = `*,*::before,*::after{animation-play-state:paused!important;animation-delay:-${tSec}s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;
         document.head.appendChild(s);
       }
       ```
     - **Minification trap:** Never assert or regex-match raw CSS duration strings like `600ms` against production builds; CSS minifiers (esbuild, LightningCSS, cssnano) rewrite `600ms` to `.6s`. Seek CSS animations via negative `animation-delay: -${tSec}s` with `animation-play-state: paused`, or compare `getComputedStyle(el).animationDuration` in seconds.
   - *No baseline captured = no visual parity claim allowed.*

2. **Anti-Shortcut Clauses (Strictly Enforced).**
   - **No baseline tampering:** Never edit, re-crop, or overwrite the baseline screenshot to force a test to pass.
   - **No tolerance inflation:** Do not widen image comparison tolerance thresholds to mask a 2px padding error.
   - **No structural cheating:** Do not add arbitrary hacky containers or wrappers that distort the DOM tree just to make a diff match.
   - *If the baseline reveals an existing upstream bug, pause and document it; do not silently alter the baseline.*

3. **Migrate Primitives Before Layouts.**
   - Restyle or migrate leaf components first (buttons, badges, inputs, typography) before composite containers and page grids.
   - **Zero magic numbers:** All spacing, typography, and color values must use project design tokens (Tailwind utilities, CSS custom properties, or theme variables). Hardcoded arbitrary pixel values (`padding: 19px`) are rejected.

4. **Verify Equivalence (Zero Pixel Delta).**
   - **Automated Image Diff:** Run the visual comparison tool (e.g., Playwright, Pixelmatch, or headless browser screenshot overlay) on pinned frames. Any nonzero pixel delta outside the recorded masks is a failure. Trace the root cause in CSS and iterate until the delta is zero.
   - **Computed Style Fallback:** If automated image diff tools are unavailable in the project, verify equivalence by asserting computed DOM metrics (`getComputedStyle`):
     - Box model dimensions: `padding`, `margin`, `border-width`, `border-radius`
     - Typography: `font-size`, `line-height`, `font-weight`, `letter-spacing`
     - Alignment: `display: flex/grid`, `gap`, `justify-content`, `align-items`

5. **Motion and Performance** (when the change touches animation, scrolling or WebGL).
   - **Frames:** compare pinned frames at the key moments of each animation (start, middle, end), not one screenshot.
   - **Frame-time budget:** measure frames on real GPU hardware while the animation runs; p95 frame time within the project's budget (default 16.7 ms, 60 fps), no long tasks over 50 ms during interaction.
   - **Reduced motion:** with `prefers-reduced-motion: reduce`, nothing essential moves and no content is lost.
   - **Loops longer than 5 s** have a visible pause control (WCAG 2.2.2).

6. **Interaction & Accessibility Polish.**
   - Verify visible focus rings for keyboard navigation (`:focus-visible`).
   - Ensure tap targets on mobile meet minimum accessible hit areas (at least 44x44px).
   - Verify color contrast ratios pass WCAG AA standards.

7. **Stage and Deliver.**
   - Rebase into clean commits. Keep before/after screenshot artifacts visible for review.

---

### Output Format

Reply with high information density:
- **Components migrated/matched:** List of files and UI components modified.
- **Viewport proof:** Confirmation of visual parity on Desktop (1280px), Mobile (375px) and each project target size.
- **Motion proof** (live surfaces): the pinning hook or masks used, frame-time p95, reduced-motion result.
- **Equivalence evidence:** Pixel difference metric (`Diff: 0 pixels`) or table of verified computed styles.
- **Accessibility verification:** Focus states and contrast checked `[observed]`.
