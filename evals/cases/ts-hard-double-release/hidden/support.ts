// Shared helpers for the hidden checks. Everything here uses only the documented ports and the public API:
// createApp(deps), app.orders, app.reservations, app.ledger, app.reconciler, Clock, Transport, WarehousePort.
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";

export const flush = async (rounds = 2) => {
  for (let i = 0; i < rounds; i++) await new Promise<void>((resolve) => setImmediate(resolve));
};

interface Timer {
  due: number;
  seq: number;
  fn: () => void;
}

export class TestClock {
  private t = 5_000_000;
  private seq = 0;
  private timers = new Set<Timer>();
  now = () => this.t;
  setTimeout = (fn: () => void, ms: number) => {
    const timer = { due: this.t + ms, seq: this.seq++, fn };
    this.timers.add(timer);
    return timer;
  };
  clearTimeout = (handle: unknown) => {
    this.timers.delete(handle as Timer);
  };
  advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      const next = [...this.timers].filter((x) => x.due <= target).sort((a, b) => a.due - b.due || a.seq - b.seq)[0];
      if (!next) break;
      this.timers.delete(next);
      this.t = Math.max(this.t, next.due);
      next.fn();
    }
    this.t = target;
  }
  /** Time passes but no timer fires: a process that was down. */
  jump(ms: number) {
    this.t += ms;
  }
}

export interface Job {
  subscriber: string;
  event: { id: string; type: string; payload: unknown; occurredAt: number };
  run(): Promise<void>;
  runs: number;
}

export class ManualTransport {
  jobs: Job[] = [];
  enqueue = (job: { subscriber: string; event: Job["event"]; run(): Promise<void> }) => {
    this.jobs.push({ subscriber: job.subscriber, event: job.event, run: job.run, runs: 0 });
  };
  pending = () => this.jobs.filter((j) => j.runs === 0);
  ran = () => this.jobs.filter((j) => j.runs > 0);
  /** Starts the job (again, if it already ran) and returns its promise. */
  start(job: Job): Promise<void> {
    job.runs++;
    return job.run();
  }
  startAllPending() {
    return Promise.all(this.pending().map((j) => this.start(j)));
  }
  ofType(type: string) {
    return this.jobs.filter((j) => j.event.type === type);
  }
}

export type Verdict = "ok" | "hang" | "fail";
export interface WarehouseCall {
  n: number;
  reservationId: string;
  sku: string;
  qty: number;
  nth: number;
}

export class ScriptedWarehouse {
  calls: Array<WarehouseCall & { verdict: Verdict }> = [];
  /** reservation id -> how many calls completed successfully */
  succeeded = new Map<string, number>();
  hops = 0;
  decide: (call: WarehouseCall) => Verdict = () => "ok";
  private gates: Array<() => void> = [];

  deallocate = async (reservationId: string, sku: string, qty: number): Promise<void> => {
    const nth = this.calls.filter((c) => c.reservationId === reservationId).length + 1;
    const call = { n: this.calls.length + 1, reservationId, sku, qty, nth };
    const verdict = this.decide(call);
    this.calls.push({ ...call, verdict });
    for (let i = 0; i < this.hops; i++) await Promise.resolve();
    if (verdict === "fail") throw new Error("warehouse unavailable");
    if (verdict === "hang") await new Promise<void>((resolve) => this.gates.push(resolve));
    this.succeeded.set(reservationId, (this.succeeded.get(reservationId) ?? 0) + 1);
  };
  hanging = () => this.gates.length;
  openAll() {
    for (const open of this.gates.splice(0)) open();
  }
}

export const TTL = 60_000;
export const RETRY = { attempts: 3, timeoutMs: 5_000, backoffMs: 1_000 };
export const ON_HAND: Record<string, number> = { "WID-1": 10, "GAD-2": 6 };

export function world(opts: { hops?: number; decide?: ScriptedWarehouse["decide"] } = {}) {
  const clock = new TestClock();
  const transport = new ManualTransport();
  const warehouse = new ScriptedWarehouse();
  warehouse.hops = opts.hops ?? 0;
  if (opts.decide) warehouse.decide = opts.decide;
  const app = createApp({ clock, transport, warehouse, config: { reservationTtlMs: TTL, retry: RETRY } });
  app.catalog.add({ sku: "WID-1", name: "Widget", priceCents: 1000, taxClass: "standard" });
  app.catalog.add({ sku: "GAD-2", name: "Gadget", priceCents: 2000, taxClass: "standard" });
  for (const [sku, qty] of Object.entries(ON_HAND)) app.ledger.receive(sku, qty);
  return { app, clock, transport, warehouse };
}
export type World = ReturnType<typeof world>;

export const counts = (app: App, sku = "WID-1") => {
  const { onHand, available, reserved, sold } = app.ledger.snapshot(sku);
  return { onHand, available, reserved, sold };
};

/** Must hold at every moment, in every interleaving (docs/inventory-model.md). */
export function weakInvariant(app: App, where: string) {
  for (const sku of Object.keys(ON_HAND)) {
    const c = app.ledger.snapshot(sku);
    const label = `${where}: ${sku} ${JSON.stringify(c)}`;
    assert.equal(c.onHand, ON_HAND[sku], `onHand changed - ${label}`);
    assert.equal(c.available + c.reserved + c.sold, c.onHand, `available + reserved + sold != onHand - ${label}`);
    assert.ok(c.available >= 0 && c.reserved >= 0 && c.sold >= 0, `negative counter - ${label}`);
  }
}

/** Holds once nothing is in flight: the counters equal what the reservation table says. */
export async function tableInvariant(app: App, where: string) {
  weakInvariant(app, where);
  const all = await app.reservations.list();
  for (const r of all) assert.ok(["active", "committed", "released"].includes(r.status), `${where}: reservation ${r.id} is ${r.status}`);
  for (const sku of Object.keys(ON_HAND)) {
    const c = app.ledger.snapshot(sku);
    const qty = (status: string) => all.filter((r) => r.sku === sku && r.status === status).reduce((n, r) => n + r.qty, 0);
    assert.equal(c.reserved, qty("active"), `${where}: ${sku} reserved ${c.reserved} but active reservations hold ${qty("active")}`);
    assert.equal(c.sold, qty("committed"), `${where}: ${sku} sold ${c.sold} but committed reservations hold ${qty("committed")}`);
  }
}

/** The jobs that react to an event by releasing stock: everything but the audit log and the customer emails. */
export const releaseJobs = (w: World, type: string) => w.transport.ofType(type).filter((j) => !/^(audit|notify)/.test(j.subscriber));

/** Runs every job that has not run yet until none are left. */
export async function drain(w: World) {
  for (let round = 0; round < 6; round++) {
    const todo = w.transport.pending();
    if (!todo.length) break;
    await Promise.all(todo.map((j) => w.transport.start(j)));
    await flush();
  }
}

export function permutations<T>(items: T[]): T[][] {
  const seen = new Set<string>();
  const out: T[][] = [];
  const rec = (rest: T[], acc: T[]) => {
    if (!rest.length) {
      const key = acc.join("|");
      if (!seen.has(key)) {
        seen.add(key);
        out.push(acc);
      }
      return;
    }
    rest.forEach((item, i) => rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, item]));
  };
  rec(items, []);
  return out;
}

export async function tolerate(codes: string[], fn: () => Promise<unknown>) {
  try {
    await fn();
    return true;
  } catch (error) {
    if (!codes.includes((error as { code?: string }).code ?? "")) throw error;
    return false;
  }
}
