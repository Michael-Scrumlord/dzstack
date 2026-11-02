import { afterAll, describe, expect, it, setDefaultTimeout } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each case spawns bash synchronously and waits on ports, so it outlives the 5 s default.
setDefaultTimeout(30_000);

const lane = join(import.meta.dir, "..", "lane.sh");
const state = mkdtempSync(join(tmpdir(), "lane-test-"));
const env = { ...process.env, LANE_STATE: state };
const bun = process.execPath;
afterAll(() => {
	spawnSync("bash", [lane, "stop", "--all"], { env });
	rmSync(state, { recursive: true, force: true });
});

function run(...args: string[]): { code: number; out: string } {
	const r = spawnSync("bash", [lane, ...args], { env, encoding: "utf8", timeout: 30_000 });
	return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

function freePort(host = "127.0.0.1"): Promise<number> {
	return new Promise((resolve, reject) => {
		const s = createServer();
		s.once("error", reject);
		s.listen(0, host, () => {
			const addr = s.address();
			const port = typeof addr === "object" && addr ? addr.port : 0;
			s.close(() => resolve(port));
		});
	});
}

function serverScript(port: number, host: string): string {
	return `Bun.serve({ port: ${port}, hostname: "${host}", fetch() { return new Response("ok"); } })`;
}

// A zombie counts as stopped: in a container whose PID 1 never reaps, a killed
// server stays in the process table although it has exited.
function alive(pid: number): boolean {
	const r = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
	const stat = (r.stdout ?? "").trim();
	return r.status === 0 && stat !== "" && !stat.startsWith("Z");
}

async function answers(port: number, host = "127.0.0.1"): Promise<boolean> {
	try {
		const url = host.includes(":") ? `http://[${host}]:${port}/` : `http://${host}:${port}/`;
		return (await fetch(url)).ok;
	} catch {
		return false;
	}
}

describe("lane.sh", () => {
	it("stops a server forked by a wrapper shell and frees its port", async () => {
		const port = await freePort();
		const child = join(state, "child.marker");
		const wrapper = `${bun} -e '${serverScript(port, "127.0.0.1")}' & echo $! > ${child}; wait`;
		const started = run("start", "web", String(port), "--", "sh", "-c", wrapper);
		expect(started.out).toContain(`lane web`);
		expect(started.code).toBe(0);
		expect(await answers(port)).toBe(true);
		const serverPid = Number(readFileSync(child, "utf8"));
		const stopped = run("stop", "web");
		expect(stopped.out).toContain(`port ${port} free`);
		expect(stopped.code).toBe(0);
		expect(await answers(port)).toBe(false);
		expect(alive(serverPid)).toBe(false);
	});

	it("never signals a process its stale record points at", async () => {
		const sleeper = spawn("sleep", ["30"], { stdio: "ignore" });
		const pid = sleeper.pid ?? 0;
		writeFileSync(join(state, "stale.pid"), `${pid}\n`);
		writeFileSync(join(state, "stale.port"), `${await freePort()}\n`);
		run("stop", "--all");
		expect(alive(pid)).toBe(true);
		sleeper.kill();
	});

	it("stops the command when it never listens before --wait", async () => {
		const port = await freePort();
		const marker = join(state, "slow-command.marker");
		const result = run("start", "slow", String(port), "--wait", "1", "--", "sh", "-c", `echo $$ > ${marker}; sleep 30; true`);
		expect(result.code).toBe(1);
		expect(result.out).toContain("not listening");
		const pid = Number(readFileSync(marker, "utf8"));
		await Bun.sleep(300);
		expect(alive(pid)).toBe(false);
		expect(run("status").out).toContain("no lanes recorded");
	});

	it("sees a server that listens on ::1 only", async () => {
		let port: number;
		try {
			port = await freePort("::1");
		} catch {
			console.log("skip: this host cannot bind ::1");
			return;
		}
		const started = run("start", "v6", String(port), "--", bun, "-e", serverScript(port, "::1"));
		expect(started.code).toBe(0);
		expect(await answers(port, "::1")).toBe(true);
		expect(run("stop", "v6").code).toBe(0);
		expect(await answers(port, "::1")).toBe(false);
	});

	it("rejects a lane name that could leave the state folder", () => {
		const r = run("start", "../x", "3000", "--", "true");
		expect(r.code).toBe(2);
		expect(r.out).toContain("lane name must match");
	});
});
