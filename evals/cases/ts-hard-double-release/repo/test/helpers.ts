import { createApp, type App, type AppDeps } from "../src/app.ts";
import type { DeliveryJob, Transport } from "../src/bus/transport.ts";
import type { Clock, TimerHandle } from "../src/platform/clock.ts";
import type { WarehousePort } from "../src/inventory/warehouse.ts";

/** Lets every pending microtask run. There are no real timers in the service under test. */
export const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

interface ManualTimer {
  due: number;
  seq: number;
  fn: () => void;
}

/** A clock that only moves when the test says so. */
export function createManualClock(start = 1_000_000) {
  let now = start;
  let seq = 0;
  const timers = new Map<ManualTimer, true>();
  const clock: Clock & { advance(ms: number): void; jump(ms: number): void; pending(): number } = {
    now: () => now,
    setTimeout(fn, ms) {
      const timer = { due: now + ms, seq: seq++, fn };
      timers.set(timer, true);
      return timer;
    },
    clearTimeout(handle: TimerHandle) {
      timers.delete(handle as ManualTimer);
    },
    /** Moves time forward and fires every timer that comes due, in order. */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers.keys()].filter((t) => t.due <= target).sort((a, b) => a.due - b.due || a.seq - b.seq)[0];
        if (!next) break;
        timers.delete(next);
        now = Math.max(now, next.due);
        next.fn();
      }
      now = target;
    },
    /** Moves time forward without firing anything: what a process that was down for a while sees. */
    jump(ms) {
      now += ms;
    },
    pending: () => timers.size,
  };
  return clock;
}

/** Collects jobs instead of running them, so a test decides when (and how often) each one runs. */
export function createManualTransport() {
  const jobs: DeliveryJob[] = [];
  const transport: Transport & { jobs: DeliveryJob[]; runAll(): Promise<void> } = {
    jobs,
    enqueue(job) {
      jobs.push(job);
    },
    async runAll() {
      for (let i = 0; i < jobs.length; i++) await jobs[i].run();
    },
  };
  return transport;
}

/** Records the calls and answers at once. */
export function createRecordingWarehouse() {
  const calls: Array<{ reservationId: string; sku: string; qty: number }> = [];
  const warehouse: WarehousePort & { calls: typeof calls } = {
    calls,
    async deallocate(reservationId, sku, qty) {
      calls.push({ reservationId, sku, qty });
    },
  };
  return warehouse;
}

export const SKUS = [
  { sku: "WID-1", name: "Widget", priceCents: 1000, taxClass: "standard" as const, stock: 20 },
  { sku: "GAD-2", name: "Gadget", priceCents: 2550, taxClass: "reduced" as const, stock: 8 },
  { sku: "BOK-3", name: "Book", priceCents: 1299, taxClass: "exempt" as const, stock: 3 },
];

/** An app with a small catalog and stock already received. */
export function makeApp(deps: AppDeps = {}): App {
  const app = createApp({ clock: createManualClock(), ...deps });
  for (const { stock, ...item } of SKUS) {
    app.catalog.add(item);
    app.ledger.receive(item.sku, stock);
  }
  return app;
}
