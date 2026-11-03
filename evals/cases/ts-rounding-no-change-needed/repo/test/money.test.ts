import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, formatDollars, fromDollars, parseAmount, roundHalfEven, splitEvenly } from "../src/money.ts";

test("rounds half to even, not half up", () => {
  assert.equal(roundHalfEven(2.5), 2);
  assert.equal(roundHalfEven(3.5), 4);
  assert.equal(roundHalfEven(12.5), 12);
  assert.equal(roundHalfEven(13.5), 14);
  assert.equal(roundHalfEven(-2.5), -2);
  assert.equal(roundHalfEven(-3.5), -4);
});

test("values that are not exactly half round to the nearest cent", () => {
  assert.equal(roundHalfEven(2.4), 2);
  assert.equal(roundHalfEven(2.6), 3);
  assert.equal(roundHalfEven(-2.6), -3);
});

test("formats whole cents", () => {
  assert.equal(formatAmount(123456), "$1,234.56");
  assert.equal(formatAmount(0), "$0.00");
  assert.equal(formatAmount(5), "$0.05");
  assert.equal(formatAmount(-5), "-$0.05");
  assert.equal(formatAmount(100000000), "$1,000,000.00");
  assert.equal(formatAmount(199, { symbol: "EUR " }), "EUR 1.99");
});

test("a half cent is formatted to the even cent", () => {
  assert.equal(formatAmount(2.5), "$0.02");
  assert.equal(formatAmount(3.5), "$0.04");
  assert.equal(formatAmount(-0.4), "$0.00");
});

test("dollars convert to cents, ties to even", () => {
  assert.equal(fromDollars(19.99), 1999);
  assert.equal(fromDollars(0.125), 12);
  assert.equal(fromDollars(0.375), 38);
  assert.equal(fromDollars(1.015), 102);
  assert.equal(formatDollars(0.125), "$0.12");
  assert.equal(formatDollars(19.99), "$19.99");
});

test("parses amounts back to cents", () => {
  assert.equal(parseAmount("$1,234.56"), 123456);
  assert.equal(parseAmount("-12.5"), -1250);
  assert.equal(parseAmount("7"), 700);
  assert.throws(() => parseAmount("12.345"), RangeError);
  assert.throws(() => parseAmount("twelve"), RangeError);
});

test("splits cents into shares that add up", () => {
  assert.deepEqual(splitEvenly(100, 3), [34, 33, 33]);
  assert.deepEqual(splitEvenly(-100, 3), [-33, -33, -34]);
  assert.equal(splitEvenly(1001, 7).reduce((a, b) => a + b, 0), 1001);
  assert.throws(() => splitEvenly(10.5, 2), RangeError);
});
