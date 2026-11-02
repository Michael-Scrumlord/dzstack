import { afterAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dir;
const script = join(here, "..", "check-plan.mjs");
const fixture = readFileSync(join(here, "fixtures", "plan-gates.md"), "utf8");
const work = mkdtempSync(join(tmpdir(), "check-plan-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

function check(text: string): { code: number; out: string } {
	const file = join(work, `plan-${Math.random().toString(36).slice(2)}.md`);
	writeFileSync(file, text);
	const run = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
	return { code: run.status ?? -1, out: `${run.stdout}${run.stderr}` };
}

function swap(text: string, from: string, to: string): string {
	expect(text.includes(from)).toBe(true);
	return text.replace(from, to);
}

describe("check-plan phase gates", () => {
	it("passes the filled fixture", () => {
		const { code, out } = check(fixture);
		expect(out).toContain("3 PR sections, 0 problems");
		expect(code).toBe(0);
	});

	it("fails a Review gate naming the wrong phase", () => {
		const { code, out } = check(swap(fixture, "**Review gate.** Phase 2 gate.", "**Review gate.** Phase 1 gate."));
		expect(out).toContain("Review gate says phase 1, but the Phase gates list it under phase 2");
		expect(code).toBe(1);
	});

	it("fails a PR in no phase gate", () => {
		const { code, out } = check(swap(fixture, "Phase 2 gate after P3.", "Phase 2 gate after P4."));
		expect(out).toContain("P3 is in no phase gate");
		expect(code).toBe(1);
	});

	it("fails a PR listed in two phases", () => {
		const { out } = check(swap(fixture, "Phase 2 gate after P3.", "Phase 2 gate after P2 and P3."));
		expect(out).toContain("P2 is in phases 1, 2");
	});

	it("fails a leftover placeholder", () => {
		const { out } = check(swap(fixture, "Searching for a tag finds its notes.", "<One observable result.>"));
		expect(out).toContain("unfilled placeholder");
	});

	it("fails review-gated PRs under autopilot-full", () => {
		const { out } = check(swap(fixture, "playbooks/autopilot-stack.md", "playbooks/autopilot-full.md"));
		expect(out).toContain("review-gated PRs run autopilot-stack, not autopilot-full");
	});

	it("fails a plan with no resume prompt", () => {
		const { out } = check(swap(fixture, "Resume the program in", "Pick up the program in"));
		expect(out).toContain('lacks "Resume the program"');
	});

	it("fails an operator lane with no pass predicate", () => {
		const { out } = check(swap(fixture, "Pass when the tag shows under the note's title.", "Check the tag."));
		expect(out).toContain("operator lane has no pass predicate");
	});

	it("fails the playbook's unfilled template", () => {
		const playbook = readFileSync(join(here, "..", "..", "playbooks", "multi-phase-plan.md"), "utf8");
		const template = playbook.split("````markdown\n")[1]?.split("\n````")[0] ?? "";
		expect(template.length).toBeGreaterThan(0);
		const { code, out } = check(template);
		expect(out).toContain("unfilled placeholder");
		expect(code).toBe(1);
	});
});
