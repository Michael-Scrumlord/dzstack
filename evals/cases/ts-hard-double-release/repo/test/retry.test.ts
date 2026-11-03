import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "../src/bus/retry.ts";
import { createManualClock, settle } from "./helpers.ts";

const options = (clock: ReturnType<typeof createManualClock>) => ({ attempts: 3, timeoutMs: 5000, backoffMs: 1000, clock });

test("a handler that works is called once", async () => {
  const clock = createManualClock();
  let calls = 0;
  await withRetry(async () => {
    calls++;
  }, options(clock))("e");
  assert.equal(calls, 1);
  assert.equal(clock.pending(), 0);
});

test("a failure is retried after a backoff that grows with each attempt", async () => {
  const clock = createManualClock();
  let calls = 0;
  const run = withRetry(async () => {
    calls++;
    if (calls < 3) throw new Error("boom");
  }, options(clock))("e");
  await settle();
  assert.equal(calls, 1);
  clock.advance(999);
  await settle();
  assert.equal(calls, 1);
  clock.advance(1);
  await settle();
  assert.equal(calls, 2);
  clock.advance(2000);
  await run;
  assert.equal(calls, 3);
});

test("after the last attempt the error is RetryExhausted with the cause", async () => {
  const clock = createManualClock();
  const run = withRetry(async () => {
    throw new Error("down");
  }, options(clock))("e");
  const outcome = run.then(() => null, (e) => e);
  for (let i = 0; i < 3; i++) {
    await settle();
    clock.advance(5000);
  }
  const error = await outcome;
  assert.equal(error.code, "retry_exhausted");
  assert.equal(error.cause.message, "down");
});

test("an attempt that takes too long counts as failed and the next one starts while it is still running", async () => {
  const clock = createManualClock();
  const gates: Array<() => void> = [];
  let started = 0;
  const run = withRetry(
    () =>
      new Promise<void>((resolve) => {
        started++;
        gates.push(resolve);
      }),
    options(clock),
  )("e");
  await settle();
  assert.equal(started, 1);
  clock.advance(5000); // the first attempt times out
  await settle();
  clock.advance(1000); // backoff
  await settle();
  assert.equal(started, 2, "the second attempt starts although the first never finished");
  gates[1]();
  await run;
  gates[0](); // the first attempt finally answers: nobody is waiting for it any more
  await settle();
});
