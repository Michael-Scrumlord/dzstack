### UI & Visual Parity Playbook

**You own pixel-exact visual fidelity. The baseline is the specification; it is sacred and untouchable.** 

Visual equivalence is verified by image comparison or computed DOM layout metrics: never by human eyeball or text-only assumptions.

---

### Execution Steps

1. **Establish the Baseline First (Blocking Prerequisite).**
   - Take screenshots of the current component/screen *before* touching a single line of styling code.
   - **Dual-Viewport Rule:** Capture the baseline across at least two viewports:
     - **Desktop:** 1280px width
     - **Mobile:** 375px width (ensures responsive layouts do not break silently)
   - **State Coverage:** If applicable, capture the component across its relevant operational states (Default, Loading, Empty, and Error).
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
   - **Automated Image Diff:** Run the visual comparison tool (e.g., Playwright, Pixelmatch, or headless browser screenshot overlay). Any nonzero pixel delta is a failure. Trace the root cause in CSS and iterate until the delta is zero.
   - **Computed Style Fallback:** If automated image diff tools are unavailable in the project, verify equivalence by asserting computed DOM metrics (`getComputedStyle`):
     - Box model dimensions: `padding`, `margin`, `border-width`, `border-radius`
     - Typography: `font-size`, `line-height`, `font-weight`, `letter-spacing`
     - Alignment: `display: flex/grid`, `gap`, `justify-content`, `align-items`

5. **Interaction & Accessibility Polish.**
   - Verify visible focus rings for keyboard navigation (`:focus-visible`).
   - Ensure tap targets on mobile meet minimum accessible hit areas (at least 44x44px).
   - Verify color contrast ratios pass WCAG AA standards.

6. **Stage and Deliver.**
   - Rebase into clean commits. Keep before/after screenshot artifacts visible for review.

---

### Output Format

Reply with high information density:
- **Components migrated/matched:** List of files and UI components modified.
- **Viewport proof:** Confirmation of visual parity on Desktop (1280px) and Mobile (375px).
- **Equivalence evidence:** Pixel difference metric (`Diff: 0 pixels`) or table of verified computed styles.
- **Accessibility verification:** Focus states and contrast checked `[observed]`.
