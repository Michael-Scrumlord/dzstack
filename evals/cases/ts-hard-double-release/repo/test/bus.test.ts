import { test } from "node:test";
import assert from "node:assert/strict";
import { createEventBus } from "../src/bus/event-bus.ts";
import { createIdGenerator } from "../src/platform/ids.ts";
import { createMemoryLogger } from "../src/platform/logger.ts";
import { createManualClock, createManualTransport, settle } from "./helpers.ts";

function setup() {
  const transport = createManualTransport();
  const bus = createEventBus({ transport, clock: createManualClock(), ids: createIdGenerator(), logger: createMemoryLogger() });
  return { bus, transport };
}

test("publishing queues one job per matching subscriber", () => {
  const { bus, transport } = setup();
  bus.subscribe("a", "one", async () => {});
  bus.subscribe("a", "two", async () => {});
  bus.subscribe("b", "other", async () => {});
  bus.subscribe("*", "all", async () => {});
  bus.publish("a", { n: 1 });
  assert.deepEqual(transport.jobs.map((j) => j.subscriber), ["one", "two", "all"]);
});

test("events carry an id, a type, the payload and the time", () => {
  const { bus } = setup();
  const event = bus.publish("a", { n: 1 });
  assert.equal(event.id, "evt_1");
  assert.equal(event.type, "a");
  assert.deepEqual(event.payload, { n: 1 });
  assert.equal(event.occurredAt, 1_000_000);
});

test("a job can run again: delivery is at least once", async () => {
  const { bus, transport } = setup();
  let seen = 0;
  bus.subscribe("a", "counter", async () => {
    seen++;
  });
  bus.publish("a", {});
  await transport.jobs[0].run();
  await transport.jobs[0].run();
  assert.equal(seen, 2);
});

test("a failing handler lands in the dead letters and does not throw", async () => {
  const { bus, transport } = setup();
  bus.subscribe("a", "bad", async () => {
    throw new Error("nope");
  });
  bus.publish("a", {});
  await transport.jobs[0].run();
  await settle();
  assert.equal(bus.deadLetters.length, 1);
  assert.equal(bus.deadLetters[0].subscriber, "bad");
});
