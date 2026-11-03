import { test } from "node:test";
import assert from "node:assert/strict";
import { configFromEnv, defaultConfig, resolveConfig } from "../src/config.ts";

test("overrides merge into the defaults, including the nested retry settings", () => {
  const config = resolveConfig({ reservationTtlMs: 1000, retry: { attempts: 5 } });
  assert.equal(config.reservationTtlMs, 1000);
  assert.deepEqual(config.retry, { ...defaultConfig.retry, attempts: 5 });
  assert.equal(config.lowStockThreshold, defaultConfig.lowStockThreshold);
});

test("environment variables override the defaults", () => {
  const config = configFromEnv({ STOCKROOM_RESERVATION_TTL_MS: "60000", STOCKROOM_RETRY_TIMEOUT_MS: "250" });
  assert.equal(config.reservationTtlMs, 60000);
  assert.equal(config.retry.timeoutMs, 250);
  assert.equal(config.retry.attempts, defaultConfig.retry.attempts);
});

test("bad values are refused", () => {
  assert.throws(() => configFromEnv({ STOCKROOM_RETRY_ATTEMPTS: "three" }), /STOCKROOM_RETRY_ATTEMPTS/);
  assert.throws(() => configFromEnv({ STOCKROOM_LOW_STOCK: "-1" }), /STOCKROOM_LOW_STOCK/);
});
